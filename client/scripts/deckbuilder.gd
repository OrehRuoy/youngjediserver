## Deckbuilder scene: browse cards, build decks with 6 color-coded slots.
extends Control

const CARD_WIDTH := 100
const CARD_HEIGHT := 140
const MAX_PER_COLOR := 10
const MAX_SAME_TITLE := 5
const SAVE_PATH := "user://decks.json"
const PREVIEW_WIDTH := 250
const PREVIEW_HEIGHT := 350

const COLOR_NAMES: Array[String] = ["red", "orange", "blue", "yellow", "green", "purple"]
const COLOR_VALUES: Dictionary = {
	"red": Color(0.85, 0.15, 0.15),
	"orange": Color(0.9, 0.55, 0.1),
	"blue": Color(0.2, 0.4, 0.85),
	"yellow": Color(0.9, 0.85, 0.15),
	"green": Color(0.15, 0.7, 0.25),
	"purple": Color(0.6, 0.2, 0.8),
}
const CARD_TYPES: Array[String] = ["All", "Character", "Weapon", "Location", "Battle", "Effect", "Starship"]
const REQUIRED_LOCATION_PLANETS: Array[String] = ["Tatooine", "Coruscant", "Naboo"]
const MIN_LOCATIONS := 3

var _deck_name: String = "New Deck"
var _deck_slots: Dictionary = {}
var _all_cards: Array = []
var _filtered_cards: Array = []
var _card_grid: GridContainer
var _deck_name_label: Label
var _deck_avg_destiny_label: Label
var _slot_containers: Dictionary = {}
var _slot_counters: Dictionary = {}
var _side_filter: OptionButton
var _type_filter: OptionButton
var _color_filter: OptionButton
var _set_filter: OptionButton
var _destiny_filter: OptionButton
var _trait_filter: OptionButton
var _title_search: LineEdit
var _gametext_search: LineEdit
var _card_scroll: ScrollContainer
var _drag_preview_card: Dictionary = {}

var _hover_popup: Control = null
var _hover_card_panel: Control = null


func _ready() -> void:
	for c in COLOR_NAMES:
		_deck_slots[c] = []
	_all_cards = CardCatalog.get_all_cards()
	_all_cards.sort_custom(func(a, b): return a.get("name", "") < b.get("name", ""))
	_filtered_cards = _all_cards.duplicate()
	_build_ui()
	_populate_card_grid()
	Connection.get_client().message_received.connect(_on_server_message)


func _process(_delta: float) -> void:
	Connection.get_client().poll()


func _on_server_message(msg: Dictionary) -> void:
	Connection.get_state().apply_message(msg)


func _build_ui() -> void:
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	add_child(margin)

	var root_hbox := HBoxContainer.new()
	root_hbox.add_theme_constant_override("separation", 12)
	margin.add_child(root_hbox)

	_build_deck_panel(root_hbox)
	_build_card_browser(root_hbox)


func _build_deck_panel(parent: HBoxContainer) -> void:
	var deck_vbox := VBoxContainer.new()
	deck_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	deck_vbox.size_flags_stretch_ratio = 0.65
	deck_vbox.custom_minimum_size = Vector2(380, 0)
	deck_vbox.add_theme_constant_override("separation", 8)
	parent.add_child(deck_vbox)

	var toolbar := HBoxContainer.new()
	toolbar.add_theme_constant_override("separation", 6)
	deck_vbox.add_child(toolbar)

	var new_btn := Button.new()
	new_btn.text = "New Deck"
	new_btn.pressed.connect(_on_new_deck)
	toolbar.add_child(new_btn)

	var save_btn := Button.new()
	save_btn.text = "Save"
	save_btn.pressed.connect(_on_save_deck)
	toolbar.add_child(save_btn)

	var load_btn := Button.new()
	load_btn.text = "Load"
	load_btn.pressed.connect(_on_load_deck)
	toolbar.add_child(load_btn)

	var delete_btn := Button.new()
	delete_btn.text = "Delete"
	delete_btn.add_theme_color_override("font_color", Color(1, 0.3, 0.3))
	delete_btn.pressed.connect(_on_delete_deck_pressed)
	toolbar.add_child(delete_btn)

	var back_btn := Button.new()
	back_btn.text = "Back"
	back_btn.pressed.connect(_on_back)
	toolbar.add_child(back_btn)

	_deck_name_label = Label.new()
	_deck_name_label.text = _deck_name
	_deck_name_label.add_theme_font_size_override("font_size", 20)
	_deck_name_label.add_theme_color_override("font_color", Color(0.95, 0.82, 0.35))
	deck_vbox.add_child(_deck_name_label)

	_deck_avg_destiny_label = Label.new()
	_deck_avg_destiny_label.add_theme_font_size_override("font_size", 16)
	_deck_avg_destiny_label.add_theme_color_override("font_color", Color(0.85, 0.85, 0.9))
	deck_vbox.add_child(_deck_avg_destiny_label)
	_update_average_destiny()

	var slot_scroll := ScrollContainer.new()
	slot_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	slot_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	deck_vbox.add_child(slot_scroll)

	var slots_vbox := VBoxContainer.new()
	slots_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slots_vbox.add_theme_constant_override("separation", 6)
	slot_scroll.add_child(slots_vbox)

	for color_name in COLOR_NAMES:
		_build_color_slot(slots_vbox, color_name)


func _build_color_slot(parent: VBoxContainer, color_name: String) -> void:
	var slot_panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.12, 0.12, 0.16, 0.9)
	style.border_color = COLOR_VALUES[color_name]
	style.border_width_left = 3
	style.border_width_top = 3
	style.border_width_right = 3
	style.border_width_bottom = 3
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	style.content_margin_left = 6
	style.content_margin_right = 6
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	slot_panel.add_theme_stylebox_override("panel", style)
	parent.add_child(slot_panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	slot_panel.add_child(vbox)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	vbox.add_child(header)

	var color_rect := ColorRect.new()
	color_rect.custom_minimum_size = Vector2(16, 16)
	color_rect.color = COLOR_VALUES[color_name]
	header.add_child(color_rect)

	var title := Label.new()
	title.text = color_name.capitalize()
	title.add_theme_color_override("font_color", COLOR_VALUES[color_name])
	header.add_child(title)

	var counter := Label.new()
	counter.text = "0 / %d" % MAX_PER_COLOR
	counter.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
	counter.size_flags_horizontal = Control.SIZE_EXPAND | Control.SIZE_SHRINK_END
	header.add_child(counter)
	_slot_counters[color_name] = counter

	var cards_flow := HFlowContainer.new()
	cards_flow.add_theme_constant_override("h_separation", 4)
	cards_flow.add_theme_constant_override("v_separation", 4)
	cards_flow.custom_minimum_size = Vector2(0, 50)
	vbox.add_child(cards_flow)
	_slot_containers[color_name] = cards_flow


func _build_card_browser(parent: HBoxContainer) -> void:
	var browser_vbox := VBoxContainer.new()
	browser_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	browser_vbox.size_flags_stretch_ratio = 0.35
	browser_vbox.custom_minimum_size = Vector2(280, 0)
	browser_vbox.add_theme_constant_override("separation", 8)
	parent.add_child(browser_vbox)

	# Filter row 1: Side, Type, Color
	var filter_row1 := HBoxContainer.new()
	filter_row1.add_theme_constant_override("separation", 8)
	browser_vbox.add_child(filter_row1)

	var side_label := Label.new()
	side_label.text = "Side:"
	side_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	filter_row1.add_child(side_label)

	_side_filter = OptionButton.new()
	_side_filter.add_item("All")
	_side_filter.add_item("Light")
	_side_filter.add_item("Dark")
	_side_filter.item_selected.connect(_on_filter_changed)
	filter_row1.add_child(_side_filter)

	var type_label := Label.new()
	type_label.text = "Type:"
	type_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	filter_row1.add_child(type_label)

	_type_filter = OptionButton.new()
	for t in CARD_TYPES:
		_type_filter.add_item(t)
	_type_filter.item_selected.connect(_on_filter_changed)
	filter_row1.add_child(_type_filter)

	var color_label := Label.new()
	color_label.text = "Color:"
	color_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	filter_row1.add_child(color_label)

	_color_filter = OptionButton.new()
	_color_filter.add_item("All")
	for cn in COLOR_NAMES:
		_color_filter.add_item(cn.capitalize())
	_color_filter.item_selected.connect(_on_filter_changed)
	filter_row1.add_child(_color_filter)

	# Filter row 2: Set, Destiny
	var filter_row2_setdest := HBoxContainer.new()
	filter_row2_setdest.add_theme_constant_override("separation", 8)
	browser_vbox.add_child(filter_row2_setdest)

	var set_label := Label.new()
	set_label.text = "Set:"
	set_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	filter_row2_setdest.add_child(set_label)

	_set_filter = OptionButton.new()
	_set_filter.add_item("All")
	var sets_found: Array[String] = []
	for card in _all_cards:
		var s: String = card.get("set", "")
		if not s.is_empty() and s not in sets_found:
			sets_found.append(s)
	sets_found.sort()
	for s in sets_found:
		_set_filter.add_item(s)
	_set_filter.item_selected.connect(_on_filter_changed)
	filter_row2_setdest.add_child(_set_filter)

	var destiny_label := Label.new()
	destiny_label.text = "Destiny:"
	destiny_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	filter_row2_setdest.add_child(destiny_label)

	_destiny_filter = OptionButton.new()
	_destiny_filter.add_item("All")
	for d in range(7):
		_destiny_filter.add_item(str(d))
	_destiny_filter.item_selected.connect(_on_filter_changed)
	filter_row2_setdest.add_child(_destiny_filter)

	var trait_label := Label.new()
	trait_label.text = "Trait:"
	trait_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	filter_row2_setdest.add_child(trait_label)

	_trait_filter = OptionButton.new()
	_trait_filter.add_item("All")
	var traits_found: Dictionary = {}
	for card in _all_cards:
		var t: String = card.get("trait", "")
		if t.is_empty():
			continue
		for part in t.split(","):
			var key: String = part.strip_edges().to_lower()
			if not key.is_empty():
				traits_found[key] = true
	var traits_list: Array[String] = []
	for k in traits_found.keys():
		traits_list.append(k)
	traits_list.sort()
	for tr in traits_list:
		_trait_filter.add_item(tr)
	_trait_filter.item_selected.connect(_on_filter_changed)
	filter_row2_setdest.add_child(_trait_filter)

	# Filter row 3: Title search, Gametext search
	var filter_row2 := HBoxContainer.new()
	filter_row2.add_theme_constant_override("separation", 8)
	browser_vbox.add_child(filter_row2)

	var title_label := Label.new()
	title_label.text = "Title:"
	title_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	filter_row2.add_child(title_label)

	_title_search = LineEdit.new()
	_title_search.placeholder_text = "Search title..."
	_title_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title_search.text_changed.connect(_on_filter_text_changed)
	filter_row2.add_child(_title_search)

	var gametext_label := Label.new()
	gametext_label.text = "Gametext:"
	gametext_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	filter_row2.add_child(gametext_label)

	_gametext_search = LineEdit.new()
	_gametext_search.placeholder_text = "Search gametext..."
	_gametext_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_gametext_search.text_changed.connect(_on_filter_text_changed)
	filter_row2.add_child(_gametext_search)

	_card_scroll = ScrollContainer.new()
	_card_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_card_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_card_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	browser_vbox.add_child(_card_scroll)

	_card_grid = GridContainer.new()
	_card_grid.columns = 6
	_card_grid.add_theme_constant_override("h_separation", 6)
	_card_grid.add_theme_constant_override("v_separation", 6)
	_card_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_card_scroll.add_child(_card_grid)


func _populate_card_grid() -> void:
	for c in _card_grid.get_children():
		c.queue_free()

	for card in _filtered_cards:
		var card_id: String = card.get("id", "")
		var side: String = card.get("side", "")
		if card_id.is_empty():
			continue

		var tex := _load_card_texture(card_id, side)
		if tex == null:
			continue

		var card_btn := _create_draggable_card(card, tex)
		_card_grid.add_child(card_btn)


func _create_draggable_card(card: Dictionary, tex: Texture2D) -> Control:
	var container := Panel.new()
	var style := StyleBoxFlat.new()
	var dot_color_name: String = card.get("dotColor", "")
	if COLOR_VALUES.has(dot_color_name):
		style.border_color = COLOR_VALUES[dot_color_name]
	else:
		style.border_color = Color(0.4, 0.4, 0.4)
	style.border_width_bottom = 2
	style.bg_color = Color(0, 0, 0, 0)
	style.corner_radius_bottom_left = 2
	style.corner_radius_bottom_right = 2
	container.add_theme_stylebox_override("panel", style)
	container.custom_minimum_size = Vector2(CARD_WIDTH, CARD_HEIGHT + 6)
	container.mouse_filter = Control.MOUSE_FILTER_STOP

	var tex_rect := TextureRect.new()
	tex_rect.texture = tex
	tex_rect.custom_minimum_size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	tex_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	tex_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	container.add_child(tex_rect)

	container.set_meta("card_data", card)
	container.set_meta("card_texture", tex)
	container.gui_input.connect(_on_card_gui_input.bind(container))
	container.mouse_entered.connect(_on_card_mouse_entered.bind(container))
	container.mouse_exited.connect(_on_card_mouse_exited)

	return container


# --- Hover preview ---

func _on_card_mouse_entered(card_panel: Control) -> void:
	_hover_card_panel = card_panel
	_show_hover_preview(card_panel)

func _on_card_mouse_exited() -> void:
	_hover_card_panel = null
	_hide_hover_preview()

func _on_deck_card_mouse_entered(card: Dictionary) -> void:
	_show_hover_preview_for_card(card)

func _on_deck_card_mouse_exited() -> void:
	_hide_hover_preview()

func _show_hover_preview(card_panel: Control) -> void:
	var card: Dictionary = card_panel.get_meta("card_data")
	_show_hover_preview_for_card(card)

func _show_hover_preview_for_card(card: Dictionary) -> void:
	_hide_hover_preview()
	var card_id: String = card.get("id", "")
	var side: String = card.get("side", "")
	var tex := _load_card_texture(card_id, side)
	if tex == null:
		return

	var popup := PanelContainer.new()
	popup.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var popup_style := StyleBoxFlat.new()
	popup_style.bg_color = Color(0.08, 0.08, 0.12, 0.95)
	popup_style.border_color = Color(0.5, 0.5, 0.6)
	popup_style.border_width_left = 2
	popup_style.border_width_top = 2
	popup_style.border_width_right = 2
	popup_style.border_width_bottom = 2
	popup_style.corner_radius_top_left = 6
	popup_style.corner_radius_top_right = 6
	popup_style.corner_radius_bottom_left = 6
	popup_style.corner_radius_bottom_right = 6
	popup_style.set_content_margin_all(6)
	popup.add_theme_stylebox_override("panel", popup_style)

	var tex_rect := TextureRect.new()
	tex_rect.texture = tex
	tex_rect.custom_minimum_size = Vector2(PREVIEW_WIDTH, PREVIEW_HEIGHT)
	tex_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	tex_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	popup.add_child(tex_rect)

	var popup_size := Vector2(PREVIEW_WIDTH + 12, PREVIEW_HEIGHT + 12)
	var vp := get_viewport().get_visible_rect().size
	var mpos := get_viewport().get_mouse_position()
	var px := mpos.x + 20
	var py := mpos.y - popup_size.y / 2.0
	if px + popup_size.x > vp.x:
		px = mpos.x - popup_size.x - 20
	py = clampf(py, 8, vp.y - popup_size.y - 8)
	popup.position = Vector2(px, py)
	popup.size = popup_size
	popup.z_index = 200

	get_tree().root.add_child(popup)
	_hover_popup = popup

func _hide_hover_preview() -> void:
	if _hover_popup and is_instance_valid(_hover_popup):
		_hover_popup.queue_free()
		_hover_popup = null


# --- Drag and double-click ---

var _dragging := false
var _drag_source: Control = null
var _drag_overlay: Control = null
var _drag_offset := Vector2.ZERO
var _last_click_time := 0.0
var _last_click_card_id := ""

func _on_card_gui_input(event: InputEvent, card_panel: Control) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			var card: Dictionary = card_panel.get_meta("card_data")
			var card_id: String = card.get("id", "")
			var now := Time.get_ticks_msec() / 1000.0
			if card_id == _last_click_card_id and (now - _last_click_time) < 0.4:
				_add_card_to_deck(card)
				_last_click_time = 0.0
				_last_click_card_id = ""
				return
			_last_click_time = now
			_last_click_card_id = card_id
			_start_drag(card_panel, event.global_position)
		else:
			if _dragging:
				_end_drag(event.global_position)

func _input(event: InputEvent) -> void:
	if _dragging and event is InputEventMouseMotion:
		if _drag_overlay:
			_drag_overlay.global_position = event.global_position - _drag_offset

func _start_drag(card_panel: Control, gpos: Vector2) -> void:
	_dragging = true
	_drag_source = card_panel
	var card: Dictionary = card_panel.get_meta("card_data")
	var tex: Texture2D = card_panel.get_meta("card_texture")
	_drag_preview_card = card
	_hide_hover_preview()

	_drag_overlay = TextureRect.new()
	_drag_overlay.texture = tex
	_drag_overlay.custom_minimum_size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	_drag_overlay.size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	_drag_overlay.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_drag_overlay.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_drag_overlay.modulate = Color(1, 1, 1, 0.8)
	_drag_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_drag_overlay.z_index = 100
	add_child(_drag_overlay)
	_drag_offset = Vector2(CARD_WIDTH / 2.0, CARD_HEIGHT / 2.0)
	_drag_overlay.global_position = gpos - _drag_offset

func _end_drag(gpos: Vector2) -> void:
	_dragging = false
	if _drag_overlay:
		_drag_overlay.queue_free()
		_drag_overlay = null

	var card: Dictionary = _drag_preview_card
	var dot_color: String = card.get("dotColor", "")

	var dropped_color := _get_drop_target_color(gpos)
	if dropped_color.is_empty():
		_show_toast("Drag card to a color slot on the left.")
		return

	if dropped_color != dot_color:
		_show_toast("This card is %s — it must go in the %s slot." % [dot_color.capitalize(), dot_color.capitalize()])
		return

	_try_add_card_to_slot(card, dropped_color)
	_drag_source = null
	_drag_preview_card = {}


func _add_card_to_deck(card: Dictionary) -> void:
	var dot_color: String = card.get("dotColor", "")
	if not COLOR_VALUES.has(dot_color):
		_show_toast("This card has no valid color.")
		return
	_try_add_card_to_slot(card, dot_color)


func _try_add_card_to_slot(card: Dictionary, color_name: String) -> void:
	var deck_side: String = _get_deck_side()
	var card_side: String = card.get("side", "")
	if not deck_side.is_empty() and card_side != deck_side:
		_show_toast("You can't play cards from both Light and Dark side in a deck.")
		return

	if _deck_slots[color_name].size() >= MAX_PER_COLOR:
		_show_toast("The %s slot is full (%d/%d)." % [color_name.capitalize(), MAX_PER_COLOR, MAX_PER_COLOR])
		return

	var card_name: String = card.get("name", "")
	var title_count := _count_title_in_deck(card_name)
	if title_count >= MAX_SAME_TITLE:
		_show_toast("Already have %d copies of '%s' (max %d)." % [title_count, card_name, MAX_SAME_TITLE])
		return

	_deck_slots[color_name].append(card)
	_refresh_slot_display(color_name)
	_show_toast("Added %s to %s slot." % [card_name, color_name.capitalize()])


func _count_title_in_deck(card_name: String) -> int:
	var count := 0
	for color_name in COLOR_NAMES:
		for c in _deck_slots[color_name]:
			if c.get("name", "") == card_name:
				count += 1
	return count


func _get_deck_side() -> String:
	for color_name in COLOR_NAMES:
		var cards: Array = _deck_slots[color_name]
		if cards.size() > 0:
			return cards[0].get("side", "")
	return ""


func _get_all_locations_in_deck() -> Array:
	var locations: Array = []
	for color_name in COLOR_NAMES:
		for card in _deck_slots[color_name]:
			if (card.get("type", "") as String).to_lower() == "location":
				locations.append(card)
	return locations


func _has_required_locations() -> bool:
	var locations: Array = _get_all_locations_in_deck()
	if locations.size() < MIN_LOCATIONS:
		return false
	var planets_found: Dictionary = {}
	for loc in locations:
		var planet: String = loc.get("planet", "")
		if planet in REQUIRED_LOCATION_PLANETS:
			planets_found[planet] = true
	for required in REQUIRED_LOCATION_PLANETS:
		if not planets_found.get(required, false):
			return false
	return true


func _get_drop_target_color(gpos: Vector2) -> String:
	for color_name in COLOR_NAMES:
		var container: HFlowContainer = _slot_containers[color_name]
		var parent_panel: PanelContainer = container.get_parent().get_parent() as PanelContainer
		if parent_panel:
			if parent_panel.get_global_rect().has_point(gpos):
				return color_name
	return ""


func _update_average_destiny() -> void:
	var total_destiny := 0
	var card_count := 0
	for color_name in COLOR_NAMES:
		for card in _deck_slots[color_name]:
			total_destiny += int(card.get("destiny", 0))
			card_count += 1
	if _deck_avg_destiny_label:
		if card_count == 0:
			_deck_avg_destiny_label.text = "Average Destiny: —"
		else:
			var avg: float = total_destiny / float(card_count)
			var display: String
			if abs(avg - roundf(avg)) < 0.001:
				display = "%d" % int(roundf(avg))
			else:
				display = "%.1f" % avg
			_deck_avg_destiny_label.text = "Average Destiny: %s" % display


func _refresh_slot_display(color_name: String) -> void:
	var container: HFlowContainer = _slot_containers[color_name]
	for c in container.get_children():
		c.queue_free()

	var cards: Array = _deck_slots[color_name]
	_slot_counters[color_name].text = "%d / %d" % [cards.size(), MAX_PER_COLOR]
	_update_average_destiny()

	for i in range(cards.size()):
		var card: Dictionary = cards[i]
		var card_id: String = card.get("id", "")
		var side: String = card.get("side", "")
		var tex := _load_card_texture(card_id, side)
		if tex == null:
			continue

		var card_tex := TextureRect.new()
		card_tex.texture = tex
		card_tex.custom_minimum_size = Vector2(42, 60)
		card_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		card_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		card_tex.tooltip_text = card.get("name", "")
		card_tex.mouse_filter = Control.MOUSE_FILTER_STOP
		card_tex.gui_input.connect(_on_deck_card_input.bind(color_name, i))
		card_tex.mouse_entered.connect(_on_deck_card_mouse_entered.bind(card))
		card_tex.mouse_exited.connect(_on_deck_card_mouse_exited)
		container.add_child(card_tex)


func _on_deck_card_input(event: InputEvent, color_name: String, index: int) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT or event.button_index == MOUSE_BUTTON_RIGHT:
			var card: Dictionary = _deck_slots[color_name][index]
			_deck_slots[color_name].remove_at(index)
			_hide_hover_preview()
			_refresh_slot_display(color_name)
			_show_toast("Removed %s from %s slot." % [card.get("name", "?"), color_name.capitalize()])


# --- Filters ---

func _on_filter_changed(_idx: int) -> void:
	_apply_filters()

func _on_filter_text_changed(_text: String) -> void:
	_apply_filters()


func _apply_filters() -> void:
	var side_idx: int = _side_filter.selected
	var side_filter: String = ""
	if side_idx == 1:
		side_filter = "light"
	elif side_idx == 2:
		side_filter = "dark"

	var type_idx: int = _type_filter.selected
	var type_filter: String = ""
	if type_idx > 0 and type_idx < CARD_TYPES.size():
		type_filter = CARD_TYPES[type_idx].to_lower()

	var color_idx: int = _color_filter.selected
	var color_filter: String = ""
	if color_idx > 0 and color_idx <= COLOR_NAMES.size():
		color_filter = COLOR_NAMES[color_idx - 1]

	var set_filter: String = ""
	if _set_filter.selected > 0 and _set_filter.selected <= _set_filter.item_count - 1:
		set_filter = _set_filter.get_item_text(_set_filter.selected)

	var destiny_filter: int = -1
	if _destiny_filter.selected > 0 and _destiny_filter.selected <= 7:
		destiny_filter = _destiny_filter.selected - 1

	var trait_filter: String = ""
	if _trait_filter.selected > 0 and _trait_filter.selected <= _trait_filter.item_count - 1:
		trait_filter = _trait_filter.get_item_text(_trait_filter.selected).to_lower()

	var title_text: String = _title_search.text.strip_edges().to_lower()
	var gametext_text: String = _gametext_search.text.strip_edges().to_lower()

	_filtered_cards.clear()
	for card in _all_cards:
		if not side_filter.is_empty() and card.get("side", "") != side_filter:
			continue
		if not type_filter.is_empty() and card.get("type", "") != type_filter:
			continue
		if not color_filter.is_empty() and card.get("dotColor", "") != color_filter:
			continue
		if not set_filter.is_empty() and card.get("set", "") != set_filter:
			continue
		if destiny_filter >= 0 and int(card.get("destiny", -1)) != destiny_filter:
			continue
		if not trait_filter.is_empty():
			var card_trait: String = card.get("trait", "").to_lower()
			var matched: bool = false
			for part in card_trait.split(","):
				if part.strip_edges() == trait_filter:
					matched = true
					break
			if not matched:
				continue
		if not title_text.is_empty():
			if card.get("name", "").to_lower().find(title_text) == -1:
				continue
		if not gametext_text.is_empty():
			if card.get("lore", "").to_lower().find(gametext_text) == -1:
				continue
		_filtered_cards.append(card)

	_populate_card_grid()


# --- Deck management ---

func _on_new_deck() -> void:
	_deck_name = "New Deck"
	_deck_name_label.text = _deck_name
	for c in COLOR_NAMES:
		_deck_slots[c].clear()
		_refresh_slot_display(c)
	_update_average_destiny()


func _on_save_deck() -> void:
	if not _has_required_locations():
		_show_toast("You must play a location from Tatooine, Naboo, and Coruscant in your deck.")
		return
	_show_name_dialog()


func _show_name_dialog() -> void:
	var dialog := AcceptDialog.new()
	dialog.title = "Save Deck"
	dialog.dialog_text = "Enter deck name:"
	dialog.min_size = Vector2(320, 140)

	var line_edit := LineEdit.new()
	line_edit.text = _deck_name if _deck_name != "New Deck" else ""
	line_edit.placeholder_text = "Deck name..."
	dialog.add_child(line_edit)

	dialog.confirmed.connect(func():
		var name_text: String = line_edit.text.strip_edges()
		if name_text.is_empty():
			name_text = "Unnamed Deck"
		_deck_name = name_text
		_deck_name_label.text = _deck_name
		_save_to_file()
		dialog.queue_free()
	)
	dialog.canceled.connect(func(): dialog.queue_free())

	add_child(dialog)
	dialog.popup_centered()


func _save_to_file() -> void:
	var all_decks: Array = _load_all_decks()

	# Determine side from first card found
	var detected_side := ""
	for color_name in COLOR_NAMES:
		for card in _deck_slots[color_name]:
			detected_side = card.get("side", "")
			if not detected_side.is_empty():
				break
		if not detected_side.is_empty():
			break

	var deck_data := {
		"name": _deck_name,
		"side": detected_side,
		"slots": {}
	}
	for color_name in COLOR_NAMES:
		var card_entries: Array = []
		for card in _deck_slots[color_name]:
			var cid: String = card.get("id", "")
			var cset: String = card.get("set", "menaceofdarthmaul")
			card_entries.append({"id": cid, "set": cset})
		deck_data["slots"][color_name] = card_entries

	var found := false
	for i in range(all_decks.size()):
		if all_decks[i].get("name", "") == _deck_name:
			all_decks[i] = deck_data
			found = true
			break
	if not found:
		all_decks.append(deck_data)

	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(all_decks, "\t"))
		file.close()
		_show_toast("Deck '%s' saved." % _deck_name)
	else:
		_show_toast("Error saving deck.")


func _load_all_decks() -> Array:
	if not FileAccess.file_exists(SAVE_PATH):
		return []
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return []
	var data = JSON.parse_string(file.get_as_text())
	file.close()
	if data is Array:
		return data
	return []


func _on_load_deck() -> void:
	var decks := _load_all_decks()
	if decks.is_empty():
		_show_toast("No saved decks found.")
		return
	_show_load_dialog(decks)


func _show_load_dialog(decks: Array) -> void:
	var dialog := AcceptDialog.new()
	dialog.title = "Load Deck"
	dialog.dialog_text = ""
	dialog.min_size = Vector2(360, 300)
	dialog.get_ok_button().visible = false

	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(320, 220)
	dialog.add_child(scroll)

	var vbox := VBoxContainer.new()
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vbox.add_theme_constant_override("separation", 4)
	scroll.add_child(vbox)

	for deck in decks:
		var deck_name_str: String = deck.get("name", "?")
		var hbox := HBoxContainer.new()
		hbox.add_theme_constant_override("separation", 8)
		vbox.add_child(hbox)

		var load_btn := Button.new()
		load_btn.text = deck_name_str
		load_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		load_btn.pressed.connect(func():
			_load_deck_data(deck)
			dialog.queue_free()
		)
		hbox.add_child(load_btn)

	var cancel_btn := Button.new()
	cancel_btn.text = "Cancel"
	cancel_btn.pressed.connect(func(): dialog.queue_free())
	vbox.add_child(cancel_btn)

	add_child(dialog)
	dialog.popup_centered()


func _load_deck_data(deck: Dictionary) -> void:
	_deck_name = deck.get("name", "New Deck")
	_deck_name_label.text = _deck_name
	var slots: Dictionary = deck.get("slots", {})

	for color_name in COLOR_NAMES:
		_deck_slots[color_name].clear()
		var card_entries: Array = slots.get(color_name, [])
		for entry in card_entries:
			var cid: String = ""
			var set_hint: String = "menaceofdarthmaul"
			if entry is String:
				cid = entry
			elif entry is Dictionary:
				cid = entry.get("id", "")
				set_hint = entry.get("set", "menaceofdarthmaul")
			if cid.is_empty():
				continue
			var info: Dictionary = CardCatalog.get_card_info(cid, "", set_hint)
			if not info.is_empty():
				_deck_slots[color_name].append(info)
		_refresh_slot_display(color_name)

	_show_toast("Loaded deck '%s'." % _deck_name)


func _on_delete_deck_pressed() -> void:
	if _deck_name == "New Deck":
		_show_toast("No deck to delete. Save a deck first.")
		return
	_show_delete_confirmation()


func _show_delete_confirmation() -> void:
	var dialog := ConfirmationDialog.new()
	dialog.title = "Delete Deck"
	dialog.dialog_text = "Are you sure you want to delete '%s'?" % _deck_name
	dialog.min_size = Vector2(360, 120)
	dialog.ok_button_text = "Yes"
	dialog.cancel_button_text = "No"

	dialog.confirmed.connect(func():
		_delete_deck(_deck_name)
		_on_new_deck()
		dialog.queue_free()
	)
	dialog.canceled.connect(func(): dialog.queue_free())

	add_child(dialog)
	dialog.popup_centered()


func _delete_deck(deck_name_str: String) -> void:
	var all_decks := _load_all_decks()
	var new_list: Array = []
	for d in all_decks:
		if d.get("name", "") != deck_name_str:
			new_list.append(d)
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(new_list, "\t"))
		file.close()
	_show_toast("Deleted deck '%s'." % deck_name_str)


func _on_back() -> void:
	_hide_hover_preview()
	get_tree().change_scene_to_file("res://scenes/main.tscn")


func _load_card_texture(card_id: String, side: String) -> Texture2D:
	if card_id.is_empty() or not CardCatalog:
		return null
	var paths_to_try: Array[String] = CardCatalog.get_card_image_paths(card_id, side)
	for p in paths_to_try:
		var tex: Texture2D = load(p) as Texture2D
		if tex:
			return tex
	return null


var _toast_label: Label = null

func _show_toast(message: String) -> void:
	if _toast_label and is_instance_valid(_toast_label):
		_toast_label.queue_free()

	_toast_label = Label.new()
	_toast_label.text = message
	_toast_label.add_theme_font_size_override("font_size", 14)
	_toast_label.add_theme_color_override("font_color", Color(1, 1, 0.7))
	_toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast_label.set_anchors_and_offsets_preset(PRESET_BOTTOM_WIDE)
	_toast_label.offset_top = -40
	_toast_label.offset_bottom = -10
	add_child(_toast_label)

	get_tree().create_timer(3.0).timeout.connect(func():
		if is_instance_valid(_toast_label):
			_toast_label.queue_free()
			_toast_label = null
	)
