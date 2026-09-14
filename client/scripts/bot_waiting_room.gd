## Bot Game waiting room: player on left (side picker, deck), bot on right (deck selectable by player).
## No Ready buttons; only Start Game. Deck dropdowns include "Random".

extends Control

const DECKS_PATH := "res://data/decks.json"
const CUSTOM_DECKS_PATH := "user://decks.json"
const RANDOM_ID := "random"

@onready var title_label: Label = $Margin/VBox/Title
@onready var player_panel: PanelContainer = $Margin/VBox/Seats/PlayerSeat
@onready var player_name_label: Label = $Margin/VBox/Seats/PlayerSeat/VBox/NameLabel
@onready var player_side_select: OptionButton = $Margin/VBox/Seats/PlayerSeat/VBox/SideSelect
@onready var player_card_back: TextureRect = $Margin/VBox/Seats/PlayerSeat/VBox/CardGlow/CardBack
@onready var player_card_glow: PanelContainer = $Margin/VBox/Seats/PlayerSeat/VBox/CardGlow
@onready var player_deck_select: OptionButton = $Margin/VBox/Seats/PlayerSeat/VBox/DeckSelect
@onready var bot_panel: PanelContainer = $Margin/VBox/Seats/BotSeat
@onready var bot_avatar: TextureRect = $Margin/VBox/Seats/BotSeat/VBox/BotAvatar
@onready var bot_name_label: Label = $Margin/VBox/Seats/BotSeat/VBox/NameLabel
@onready var bot_deck_select: OptionButton = $Margin/VBox/Seats/BotSeat/VBox/DeckSelect
@onready var bot_style_select: OptionButton = $Margin/VBox/Seats/BotSeat/VBox/StyleSelect
@onready var leave_btn: Button = $Margin/VBox/ActionsBar/Actions/LeaveBtn
@onready var start_btn: Button = $Margin/VBox/ActionsBar/Actions/StartBtn
@onready var status_label: Label = $Margin/VBox/StatusLabel
@onready var wire_decoration: Control = $WireDecoration

var _light_decks: Array[Dictionary] = []
var _dark_decks: Array[Dictionary] = []
var _deck_select_ignore: bool = false
var _player_side: String = "light"
var _last_player_custom_id: String = ""
var _last_bot_custom_id: String = ""


func _ready() -> void:
	_load_decks()
	_load_custom_decks()
	var client: RefCounted = Connection.get_client()
	var state: RefCounted = Connection.get_state()
	client.message_received.connect(_on_message)
	player_name_label.text = state.player_name
	bot_name_label.text = "R1-V4L"
	_player_side = "light"
	state.my_side = _player_side
	leave_btn.pressed.connect(_on_leave_pressed)
	start_btn.pressed.connect(_on_start_pressed)
	player_side_select.item_selected.connect(_on_player_side_selected)
	player_deck_select.item_selected.connect(_on_player_deck_selected)
	bot_deck_select.item_selected.connect(_on_bot_deck_selected)
	state.game_started.connect(_on_game_started)
	state.error_received.connect(_on_error)
	_refresh_ui()
	call_deferred("_update_wires")


func _on_message(msg: Dictionary) -> void:
	Connection.get_state().apply_message(msg)


func _make_panel_style(is_blue: bool) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	if is_blue:
		s.bg_color = Color(0.03, 0.06, 0.16, 0.92)
		s.border_color = Color(0.2, 0.45, 0.8, 0.9)
		s.shadow_color = Color(0.1, 0.25, 0.55, 0.3)
	else:
		s.bg_color = Color(0.14, 0.04, 0.04, 0.92)
		s.border_color = Color(0.75, 0.2, 0.2, 0.9)
		s.shadow_color = Color(0.45, 0.1, 0.1, 0.3)
	s.set_border_width_all(2)
	s.set_corner_radius_all(10)
	s.set_content_margin_all(20)
	s.shadow_size = 12
	s.shadow_offset = Vector2(0, 2)
	return s


func _make_glow_style(is_blue: bool) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	if is_blue:
		s.bg_color = Color(0.15, 0.35, 0.75, 0.25)
		s.shadow_color = Color(0.2, 0.4, 0.9, 0.45)
	else:
		s.bg_color = Color(0.6, 0.15, 0.15, 0.25)
		s.shadow_color = Color(0.85, 0.2, 0.2, 0.45)
	s.set_corner_radius_all(8)
	s.set_content_margin_all(10)
	s.shadow_size = 18
	s.shadow_offset = Vector2(0, 0)
	return s


func _process(_delta: float) -> void:
	Connection.get_client().poll()


func _load_decks() -> void:
	if not FileAccess.file_exists(DECKS_PATH):
		return
	var file := FileAccess.open(DECKS_PATH, FileAccess.READ)
	if not file:
		return
	var data = JSON.parse_string(file.get_as_text())
	file.close()
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
		var card_counts: Dictionary = {}
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
		if deck_side.is_empty() and CardCatalog:
			var first_id: String = cards_list[0].get("id", "")
			var info: Dictionary = CardCatalog.get_card_info(first_id)
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


func _refresh_ui() -> void:
	title_label.text = "Bot Game"
	player_side_select.clear()
	player_side_select.add_item("Light", 0)
	player_side_select.add_item("Dark", 1)
	player_side_select.selected = 0 if _player_side == "light" else 1

	var player_is_light: bool = _player_side == "light"

	player_panel.add_theme_stylebox_override("panel", _make_panel_style(player_is_light))
	bot_panel.add_theme_stylebox_override("panel", _make_panel_style(not player_is_light))
	player_card_glow.add_theme_stylebox_override("panel", _make_glow_style(player_is_light))

	var player_decks: Array[Dictionary] = _light_decks if player_is_light else _dark_decks
	var bot_side: String = "dark" if player_is_light else "light"
	var bot_decks: Array[Dictionary] = _light_decks if bot_side == "light" else _dark_decks

	_populate_deck_dropdown(player_deck_select, player_decks)
	_populate_deck_dropdown(bot_deck_select, bot_decks)
	_apply_player_cover_art(player_is_light, player_decks)
	var player_accent: Color = DropdownStyle.LIGHT_ACCENT if player_is_light else DropdownStyle.DARK_ACCENT
	var bot_accent: Color = DropdownStyle.DARK_ACCENT if player_is_light else DropdownStyle.LIGHT_ACCENT
	DropdownStyle.apply(player_side_select, player_accent, theme)
	DropdownStyle.apply(player_deck_select, player_accent, theme)
	DropdownStyle.apply(bot_deck_select, bot_accent, theme)
	if bot_style_select:
		_fill_style_dropdown()
		DropdownStyle.apply(bot_style_select, bot_accent, theme)
	status_label.text = ""
	call_deferred("_update_wires")


func _populate_deck_dropdown(btn: OptionButton, decks: Array[Dictionary]) -> void:
	_deck_select_ignore = true
	btn.clear()
	btn.add_item("Random", 0)
	for i in decks.size():
		var d: Dictionary = decks[i]
		var display_name: String = d.get("name", "?")
		if d.get("is_custom", false):
			display_name = display_name + " (custom)"
		btn.add_item(display_name, i + 1)
	_deck_select_ignore = false


func _on_player_side_selected(idx: int) -> void:
	if _deck_select_ignore:
		return
	_player_side = "light" if idx == 0 else "dark"
	Connection.get_state().my_side = _player_side
	_refresh_ui()


func _on_player_deck_selected(_idx: int) -> void:
	if _deck_select_ignore:
		return
	var player_is_light: bool = _player_side == "light"
	var player_decks: Array[Dictionary] = _light_decks if player_is_light else _dark_decks
	_apply_player_cover_art(player_is_light, player_decks)


func _cover_from_raw(raw: Variant) -> Dictionary:
	if raw is Dictionary:
		var cid: String = str(raw.get("id", "")).strip_edges()
		if cid.is_empty():
			return {}
		return { "id": cid, "set": str(raw.get("set", "")).strip_edges() }
	return {}


func _apply_player_cover_art(player_is_light: bool, player_decks: Array[Dictionary]) -> void:
	if player_card_back == null:
		return
	var cover: Dictionary = {}
	var idx: int = player_deck_select.selected
	if idx > 0 and idx - 1 < player_decks.size():
		var d: Dictionary = player_decks[idx - 1]
		cover = _cover_from_raw(d.get("coverCard", {}))
	var side := "light" if player_is_light else "dark"
	var cover_id: String = str(cover.get("id", ""))
	if not cover_id.is_empty():
		var tex: Texture2D = CoverArt.load_texture(cover_id, side, str(cover.get("set", "")))
		if tex:
			player_card_back.texture = tex
			return
	player_card_back.texture = load("res://assets/card_back_light.png" if player_is_light else "res://assets/card_back_dark.png") as Texture2D


func _on_bot_deck_selected(_idx: int) -> void:
	if _deck_select_ignore:
		return
	# Selection is kept; no need to refresh and reset the dropdown


func _get_player_deck_selection() -> Dictionary:
	var idx: int = player_deck_select.selected
	var decks: Array[Dictionary] = _light_decks if _player_side == "light" else _dark_decks
	if idx <= 0:
		return {"id": RANDOM_ID, "custom": []}
	if idx - 1 >= decks.size():
		return {"id": "starter_deck" if _player_side == "light" else "starter_dark_deck", "custom": []}
	var d: Dictionary = decks[idx - 1]
	if d.get("is_custom", false):
		return {"id": d.get("id", ""), "custom": d.get("cards", [])}
	return {"id": d.get("id", ""), "custom": []}


func _get_bot_deck_selection() -> Dictionary:
	var idx: int = bot_deck_select.selected
	var bot_side: String = "dark" if _player_side == "light" else "light"
	var decks: Array[Dictionary] = _light_decks if bot_side == "light" else _dark_decks
	if idx <= 0:
		return {"id": RANDOM_ID, "custom": []}
	if idx - 1 >= decks.size():
		return {"id": "starter_deck" if bot_side == "light" else "starter_dark_deck", "custom": []}
	var d: Dictionary = decks[idx - 1]
	if d.get("is_custom", false):
		return {"id": d.get("id", ""), "custom": d.get("cards", [])}
	return {"id": d.get("id", ""), "custom": []}


func _fill_style_dropdown() -> void:
	if bot_style_select == null or bot_style_select.item_count > 0:
		return
	bot_style_select.add_item("Style: Random", 0)
	bot_style_select.add_item("Style: Match deck", 1)
	bot_style_select.add_item("Style: Neutral", 2)
	bot_style_select.add_item("Style: Aggressive", 3)
	bot_style_select.add_item("Style: Passive", 4)
	bot_style_select.selected = 1


func _get_bot_style() -> String:
	if bot_style_select == null:
		return "auto"
	match bot_style_select.selected:
		1:
			return "auto"
		2:
			return "balanced"
		3:
			return "aggressive"
		4:
			return "passive"
		_:
			return "random"


func _on_leave_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/main.tscn")


func _on_start_pressed() -> void:
	if not Connection.get_client().is_connected_to_server():
		status_label.text = "Not connected"
		return
	var player_deck: Dictionary = _get_player_deck_selection()
	var bot_deck: Dictionary = _get_bot_deck_selection()
	var player_custom: Array = []
	if player_deck.get("custom", []).size() > 0:
		for c in player_deck.custom:
			player_custom.append({"id": c.get("id", ""), "set": c.get("set", "menaceofdarthmaul"), "count": c.get("count", 1)})
	var bot_custom: Array = []
	if bot_deck.get("custom", []).size() > 0:
		for c in bot_deck.custom:
			bot_custom.append({"id": c.get("id", ""), "set": c.get("set", "menaceofdarthmaul"), "count": c.get("count", 1)})
	var payload: Dictionary = {
		"type": "start_bot_game",
		"playerSide": _player_side,
		"botStyle": _get_bot_style(),
	}
	var player_deck_id: String = str(player_deck.get("id", ""))
	if not player_deck_id.is_empty():
		payload["playerDeckId"] = player_deck_id
	if player_custom.size() > 0:
		payload["playerDeckCustom"] = player_custom
	var bot_deck_id: String = str(bot_deck.get("id", ""))
	if not bot_deck_id.is_empty():
		payload["botDeckId"] = bot_deck_id
	if bot_custom.size() > 0:
		payload["botDeckCustom"] = bot_custom
	# send_message works with the itch launcher client; start_bot_game() there has no botStyle arg.
	Connection.get_client().send_message(payload)
	start_btn.disabled = true
	status_label.text = "Starting game..."


func _on_game_started(_payload: Dictionary) -> void:
	get_tree().change_scene_to_file("res://scenes/game_scene.tscn")


func _on_error(msg: String) -> void:
	status_label.text = msg
	start_btn.disabled = false


func _update_wires() -> void:
	if not wire_decoration or not player_panel or not bot_panel:
		return
	var player_is_light: bool = _player_side == "light"
	var left_rect := Rect2(player_panel.global_position, player_panel.size)
	var right_rect := Rect2(bot_panel.global_position, bot_panel.size)
	var left_color := Color(0.25, 0.5, 0.85, 0.35) if player_is_light else Color(0.75, 0.25, 0.25, 0.35)
	var right_color := Color(0.75, 0.25, 0.25, 0.35) if player_is_light else Color(0.25, 0.5, 0.85, 0.35)
	wire_decoration.setup(left_rect, right_rect, left_color, right_color)


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		call_deferred("_update_wires")
