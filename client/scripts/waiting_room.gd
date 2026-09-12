## Waiting Room scene: shown when you're at a table, before the game starts.
## Shows both seats (Light/Dark), deck dropdown per side, Ready state, Leave / Ready / Start.

extends Control

const DECKS_PATH := "res://data/decks.json"
const CUSTOM_DECKS_PATH := "user://decks.json"
const DEFAULT_LIGHT_DECK := "starter_deck"
const DEFAULT_DARK_DECK := "starter_dark_deck"

@onready var title_label: Label = $Margin/VBox/Title
@onready var light_panel: PanelContainer = $Margin/VBox/Seats/LightSeat
@onready var light_name_label: Label = $Margin/VBox/Seats/LightSeat/VBox/NameLabel
@onready var light_status_label: Label = $Margin/VBox/Seats/LightSeat/VBox/StatusLabel
@onready var light_deck_select: OptionButton = $Margin/VBox/Seats/LightSeat/VBox/DeckSelect
@onready var light_card_art: TextureRect = $Margin/VBox/Seats/LightSeat/VBox/CardGlow/CardBack
@onready var dark_panel: PanelContainer = $Margin/VBox/Seats/DarkSeat
@onready var dark_name_label: Label = $Margin/VBox/Seats/DarkSeat/VBox/NameLabel
@onready var dark_status_label: Label = $Margin/VBox/Seats/DarkSeat/VBox/StatusLabel
@onready var dark_deck_select: OptionButton = $Margin/VBox/Seats/DarkSeat/VBox/DeckSelect
@onready var dark_card_art: TextureRect = $Margin/VBox/Seats/DarkSeat/VBox/CardGlow/CardBack
@onready var leave_btn: Button = $Margin/VBox/ActionsBar/Actions/LeaveBtn
@onready var ready_btn: Button = $Margin/VBox/ActionsBar/Actions/ReadyBtn
@onready var start_btn: Button = $Margin/VBox/ActionsBar/Actions/StartBtn
@onready var status_label: Label = $Margin/VBox/StatusLabel
@onready var wire_decoration: Control = $WireDecoration

var _light_decks: Array[Dictionary] = []
var _dark_decks: Array[Dictionary] = []
var _deck_select_ignore_change: bool = false
var _last_light_custom_deck_id: String = ""
var _last_dark_custom_deck_id: String = ""


func _ready() -> void:
	_load_decks()
	_load_custom_decks()
	var client: RefCounted = Connection.get_client()
	var state: RefCounted = Connection.get_state()
	client.message_received.connect(_on_message)
	state.table_updated.connect(_on_table_updated)
	state.lobby_updated.connect(_on_lobby_updated)
	state.game_started.connect(_on_game_started)
	state.game_ended.connect(_on_game_ended)
	state.error_received.connect(_on_error)
	leave_btn.pressed.connect(_on_leave_pressed)
	ready_btn.pressed.connect(_on_ready_pressed)
	start_btn.pressed.connect(_on_start_pressed)
	light_deck_select.item_selected.connect(_on_light_deck_selected)
	dark_deck_select.item_selected.connect(_on_dark_deck_selected)
	DropdownStyle.apply(light_deck_select, DropdownStyle.LIGHT_ACCENT, theme)
	DropdownStyle.apply(dark_deck_select, DropdownStyle.DARK_ACCENT, theme)
	_refresh()
	call_deferred("_update_wires")


func _process(_delta: float) -> void:
	Connection.get_client().poll()


func _load_decks() -> void:
	if not FileAccess.file_exists(DECKS_PATH):
		return
	var file := FileAccess.open(DECKS_PATH, FileAccess.READ)
	if not file:
		return
	var json := JSON.new()
	var err := json.parse(file.get_as_text())
	file.close()
	if err != OK:
		return
	var data = json.get_data()
	if data is Dictionary and data.has("decks"):
		for d in data.decks:
			var deck: Dictionary = d
			var side: String = deck.get("side", "")
			if side == "light":
				_light_decks.append(deck)
			elif side == "dark":
				_dark_decks.append(deck)


func _load_custom_decks() -> void:
	if not FileAccess.file_exists(CUSTOM_DECKS_PATH):
		return
	var file := FileAccess.open(CUSTOM_DECKS_PATH, FileAccess.READ)
	if not file:
		return
	var data = JSON.parse_string(file.get_as_text())
	file.close()
	if not data is Array:
		return
	for deck in data:
		if not deck is Dictionary:
			continue
		var deck_name: String = deck.get("name", "")
		var deck_side: String = deck.get("side", "")
		var slots: Dictionary = deck.get("slots", {})
		if deck_name.is_empty() or slots.is_empty():
			continue

		# Convert slots format to {id, set, count} card list (set for same-name cards across sets)
		var card_counts: Dictionary = {}  # key "id:set" -> count
		for color_name in slots.keys():
			var entries: Array = slots[color_name]
			for entry in entries:
				var cid: String = ""
				var cset: String = "menaceofdarthmaul"
				if entry is String:
					cid = entry
				elif entry is Dictionary:
					cid = entry.get("id", "")
					cset = entry.get("set", "menaceofdarthmaul")
				if cid.is_empty():
					continue
				var key: String = cid + ":" + cset
				if card_counts.has(key):
					card_counts[key] += 1
				else:
					card_counts[key] = 1
		var cards_list: Array = []
		for key in card_counts.keys():
			var parts: PackedStringArray = key.split(":", false, 1)
			var cid: String = parts[0]
			var cset: String = parts[1] if parts.size() > 1 else "menaceofdarthmaul"
			cards_list.append({"id": cid, "set": cset, "count": card_counts[key]})

		if cards_list.is_empty():
			continue

		# Determine side from first card if not set
		if deck_side.is_empty() and cards_list.size() > 0:
			var first: Dictionary = cards_list[0]
			var info: Dictionary = CardCatalog.get_card_info(first.get("id", ""), "", first.get("set", "menaceofdarthmaul"))
			deck_side = info.get("side", "light")

		var custom_entry: Dictionary = {
			"id": "custom_" + deck_name,
			"name": deck_name,
			"side": deck_side,
			"cards": cards_list,
			"is_custom": true,
			"coverCard": _cover_from_raw(deck.get("coverCard", {})),
		}

		if deck_side == "light":
			_light_decks.append(custom_entry)
		elif deck_side == "dark":
			_dark_decks.append(custom_entry)


func _on_message(msg: Dictionary) -> void:
	Connection.get_state().apply_message(msg)


func _player_name(state: RefCounted, table: Dictionary, key: String) -> String:
	var pid: String = table.get(key, "")
	if pid.is_empty():
		return "—"
	for p in state.players:
		if p.get("id", "") == pid:
			return p.get("name", "?")
	return "?"


func _refresh() -> void:
	var state: RefCounted = Connection.get_state()
	var table: Dictionary = state.current_table
	var game_num: String = _game_number(table.get("id", ""))
	title_label.text = "%s — Waiting for players" % game_num
	var light_name: String = _player_name(state, table, "lightPlayerId")
	var dark_name: String = _player_name(state, table, "darkPlayerId")
	var light_ready: bool = table.get("lightReady", false)
	var dark_ready: bool = table.get("darkReady", false)
	var light_deck_id: String = table.get("lightDeckId", DEFAULT_LIGHT_DECK)
	var dark_deck_id: String = table.get("darkDeckId", DEFAULT_DARK_DECK)
	light_name_label.text = "LIGHT" if light_name == "—" else light_name
	light_status_label.text = "Ready" if light_ready else "Not ready"
	light_status_label.add_theme_color_override("font_color", Color(0.3, 0.85, 0.35) if light_ready else Color(0.55, 0.6, 0.7))
	dark_name_label.text = "DARK" if dark_name == "—" else dark_name
	dark_status_label.text = "Ready" if dark_ready else "Not ready"
	dark_status_label.add_theme_color_override("font_color", Color(0.3, 0.85, 0.35) if dark_ready else Color(0.55, 0.6, 0.7))
	_populate_deck_dropdown(light_deck_select, _light_decks, light_deck_id, _last_light_custom_deck_id)
	_populate_deck_dropdown(dark_deck_select, _dark_decks, dark_deck_id, _last_dark_custom_deck_id)
	_apply_seat_art(light_card_art, "light", _cover_for_seat("light", table))
	_apply_seat_art(dark_card_art, "dark", _cover_for_seat("dark", table))
	light_deck_select.disabled = state.my_side != "light" or light_name == "—"
	dark_deck_select.disabled = state.my_side != "dark" or dark_name == "—"
	var is_host: bool = table.get("hostId", "") == state.player_id
	start_btn.visible = is_host
	var both_ready: bool = light_ready and dark_ready
	start_btn.disabled = not both_ready or light_name == "—" or dark_name == "—"
	var my_ready: bool = light_ready if state.my_side == "light" else dark_ready
	ready_btn.button_pressed = my_ready
	ready_btn.text = "Ready" if my_ready else "Not ready"


func _populate_deck_dropdown(btn: OptionButton, decks: Array[Dictionary], selected_id: String, custom_override_id: String = "") -> void:
	_deck_select_ignore_change = true
	btn.clear()
	var sel_idx := 0
	var id_to_match: String = selected_id
	if selected_id == "custom" and not custom_override_id.is_empty():
		id_to_match = custom_override_id
	for i in decks.size():
		var d: Dictionary = decks[i]
		var display_name: String = d.get("name", "?")
		if d.get("is_custom", false):
			display_name = display_name + " (custom)"
		btn.add_item(display_name, i)
		if d.get("id", "") == id_to_match:
			sel_idx = i
	btn.selected = sel_idx
	_deck_select_ignore_change = false


func _on_light_deck_selected(idx: int) -> void:
	if _deck_select_ignore_change or idx < 0 or idx >= _light_decks.size():
		return
	var deck: Dictionary = _light_decks[idx]
	_apply_seat_art(light_card_art, "light", deck.get("coverCard", {}))
	if deck.get("is_custom", false):
		_last_light_custom_deck_id = deck.get("id", "")
		_send_custom_deck(deck)
	else:
		_last_light_custom_deck_id = ""
		Connection.get_client().table_deck_select(deck.get("id", ""))


func _on_dark_deck_selected(idx: int) -> void:
	if _deck_select_ignore_change or idx < 0 or idx >= _dark_decks.size():
		return
	var deck: Dictionary = _dark_decks[idx]
	_apply_seat_art(dark_card_art, "dark", deck.get("coverCard", {}))
	if deck.get("is_custom", false):
		_last_dark_custom_deck_id = deck.get("id", "")
		_send_custom_deck(deck)
	else:
		_last_dark_custom_deck_id = ""
		Connection.get_client().table_deck_select(deck.get("id", ""))


func _send_custom_deck(deck: Dictionary) -> void:
	var msg: Dictionary = { "type": "table_deck_select_custom", "name": "custom", "cards": deck.get("cards", []) }
	var cover: Dictionary = _cover_from_raw(deck.get("coverCard", {}))
	var cid: String = str(cover.get("id", "")).strip_edges()
	if cid.is_empty():
		msg["coverCard"] = null
	else:
		msg["coverCard"] = { "id": cid, "set": str(cover.get("set", "")).strip_edges() }
	Connection.get_client().send_message(msg)


func _cover_from_raw(raw: Variant) -> Dictionary:
	if raw is Dictionary:
		var cid: String = str(raw.get("id", "")).strip_edges()
		if cid.is_empty():
			return {}
		return { "id": cid, "set": str(raw.get("set", "")).strip_edges() }
	return {}


func _cover_for_seat(side: String, table: Dictionary) -> Dictionary:
	var key := "lightCoverCard" if side == "light" else "darkCoverCard"
	var from_table: Variant = table.get(key, {})
	if from_table is Dictionary:
		var parsed: Dictionary = _cover_from_raw(from_table)
		if not parsed.is_empty():
			return parsed
	var decks: Array[Dictionary] = _light_decks if side == "light" else _dark_decks
	var btn: OptionButton = light_deck_select if side == "light" else dark_deck_select
	var idx: int = btn.selected
	if idx >= 0 and idx < decks.size():
		return _cover_from_raw(decks[idx].get("coverCard", {}))
	return {}


func _apply_seat_art(tex_rect: TextureRect, side: String, cover_var: Variant) -> void:
	if tex_rect == null:
		return
	var cover: Dictionary = _cover_from_raw(cover_var)
	var cover_id: String = str(cover.get("id", "")).strip_edges()
	if not cover_id.is_empty():
		var tex: Texture2D = CoverArt.load_texture(cover_id, side, str(cover.get("set", "")))
		if tex:
			tex_rect.texture = tex
			return
	var back_path := "res://assets/card_back_light.png" if side == "light" else "res://assets/card_back_dark.png"
	tex_rect.texture = load(back_path) as Texture2D


func _game_number(table_id: String) -> String:
	if table_id.is_empty():
		return "Game #?"
	if table_id.begins_with("table_"):
		return "Game #" + table_id.trim_prefix("table_")
	return "Game #" + table_id


func _on_table_updated(_table: Dictionary) -> void:
	_refresh()


func _on_lobby_updated() -> void:
	# Host disbanded the table or we were removed; go back to lobby.
	if Connection.get_state().current_table_id.is_empty():
		get_tree().change_scene_to_file("res://scenes/main.tscn")


func _on_leave_pressed() -> void:
	Connection.get_client().table_leave()
	Connection.get_state().leave_table_state()
	get_tree().change_scene_to_file("res://scenes/main.tscn")


func _on_ready_pressed() -> void:
	Connection.get_client().table_ready(ready_btn.button_pressed)
	ready_btn.text = "Ready" if ready_btn.button_pressed else "Not ready"


func _on_start_pressed() -> void:
	Connection.get_client().table_start()


func _on_game_started(_payload: Dictionary) -> void:
	get_tree().change_scene_to_file("res://scenes/game_scene.tscn")


func _on_game_ended(_payload: Dictionary) -> void:
	get_tree().change_scene_to_file("res://scenes/main.tscn")


func _on_error(msg: String) -> void:
	status_label.text = "Error: %s" % msg


func _update_wires() -> void:
	if not wire_decoration or not light_panel or not dark_panel:
		return
	var left_rect := Rect2(light_panel.global_position, light_panel.size)
	var right_rect := Rect2(dark_panel.global_position, dark_panel.size)
	wire_decoration.setup(left_rect, right_rect,
		Color(0.25, 0.5, 0.85, 0.35),
		Color(0.75, 0.25, 0.25, 0.35))


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		call_deferred("_update_wires")
