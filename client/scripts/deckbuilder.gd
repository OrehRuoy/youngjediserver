## Deckbuilder scene: browse cards, build decks with 6 color-coded slots.
extends Control

const CardArt = preload("res://scripts/card_art.gd")

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
const DECK_THEME: Theme = preload("res://theme/lobby_theme.tres")
const GOLD := Color(0.95, 0.82, 0.35, 1)
const FILTER_LABEL_COLOR := Color(0.62, 0.68, 0.82, 1)
const GRID_SPACING := 6

var _deck_name: String = "New Deck"
var _deck_slots: Dictionary = {}
var _all_cards: Array = []
var _filtered_cards: Array = []
var _card_grid: GridContainer
var _deck_name_label: Label
var _deck_avg_destiny_label: Label
var _location_warning_label: Label
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
var _results_label: Label
var _drag_preview_card: Dictionary = {}

var _hover_popup: Control = null
var _hover_card_panel: Control = null
var _cover_card: Dictionary = {}
var _cover_panel: PanelContainer
var _cover_tex: TextureRect
var _cover_empty_label: Label


func _ready() -> void:
	for c in COLOR_NAMES:
		_deck_slots[c] = []
	# The launcher loads the catalog before the game pack exists, so reload here.
	if CardCatalog and CardCatalog.has_method("_load_index"):
		CardCatalog._load_index()
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
	theme = DECK_THEME
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	add_child(margin)

	var outer := VBoxContainer.new()
	outer.add_theme_constant_override("separation", 12)
	margin.add_child(outer)
	_build_header(outer)

	var root_hbox := HBoxContainer.new()
	root_hbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root_hbox.add_theme_constant_override("separation", 12)
	outer.add_child(root_hbox)

	_build_deck_panel(root_hbox)
	_build_card_browser(root_hbox)


func _build_header(parent: VBoxContainer) -> void:
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	parent.add_child(header)

	var title := Label.new()
	title.text = "DECK BUILDER"
	title.theme_type_variation = &"TitleLabel"
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	header.add_child(title)

	var buttons := [
		["New Deck", _on_new_deck, &"ToolbarButton"],
		["Load", _on_load_deck, &"ToolbarButton"],
		["Save", _on_save_deck, &"PrimaryButton"],
		["Delete", _on_delete_deck_pressed, &"DangerButton"],
		["Back", _on_back, &"ToolbarButton"],
	]
	for spec in buttons:
		var btn := Button.new()
		btn.text = spec[0]
		btn.theme_type_variation = spec[2]
		btn.custom_minimum_size = Vector2(88, 34)
		btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		btn.pressed.connect(spec[1])
		header.add_child(btn)


func _section_panel(border: Color) -> PanelContainer:
	var panel := PanelContainer.new()
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.03, 0.05, 0.12, 0.88)
	s.border_color = border
	s.set_border_width_all(1)
	s.set_corner_radius_all(10)
	s.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", s)
	return panel


func _build_deck_panel(parent: HBoxContainer) -> void:
	var deck_panel := _section_panel(Color(0.18, 0.38, 0.65, 0.8))
	deck_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	deck_panel.size_flags_stretch_ratio = 0.9
	deck_panel.custom_minimum_size = Vector2(380, 0)
	parent.add_child(deck_panel)

	var deck_vbox := VBoxContainer.new()
	deck_vbox.add_theme_constant_override("separation", 10)
	deck_panel.add_child(deck_vbox)

	var info_row := HBoxContainer.new()
	info_row.add_theme_constant_override("separation", 14)
	deck_vbox.add_child(info_row)
	_build_cover_slot(info_row)

	var info_col := VBoxContainer.new()
	info_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info_col.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	info_col.add_theme_constant_override("separation", 4)
	info_row.add_child(info_col)

	_deck_name_label = Label.new()
	_deck_name_label.text = _deck_name
	_deck_name_label.theme_type_variation = &"HeaderLabel"
	_deck_name_label.add_theme_font_size_override("font_size", 18)
	_deck_name_label.clip_text = true
	_deck_name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	info_col.add_child(_deck_name_label)

	_deck_avg_destiny_label = Label.new()
	_deck_avg_destiny_label.add_theme_font_size_override("font_size", 14)
	_deck_avg_destiny_label.add_theme_color_override("font_color", Color(0.82, 0.86, 0.96))
	info_col.add_child(_deck_avg_destiny_label)
	_update_average_destiny()

	_location_warning_label = Label.new()
	_location_warning_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_location_warning_label.add_theme_font_size_override("font_size", 13)
	_location_warning_label.add_theme_color_override("font_color", Color(1.0, 0.62, 0.32, 1))
	info_col.add_child(_location_warning_label)
	_update_location_warning()

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


func _build_cover_slot(parent: HBoxContainer) -> void:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 3)
	col.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	parent.add_child(col)

	_cover_panel = PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.08, 0.17, 0.95)
	style.border_color = Color(0.86, 0.72, 0.32, 0.8)
	style.set_border_width_all(1)
	style.set_corner_radius_all(6)
	style.set_content_margin_all(3)
	_cover_panel.add_theme_stylebox_override("panel", style)
	_cover_panel.custom_minimum_size = Vector2(56, 76)
	_cover_panel.tooltip_text = "Optional table art — not in your deck. Leave empty if you want. Drag a card here, click to remove."
	col.add_child(_cover_panel)

	_cover_tex = TextureRect.new()
	_cover_tex.custom_minimum_size = Vector2(48, 68)
	_cover_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_cover_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_cover_tex.mouse_filter = Control.MOUSE_FILTER_STOP
	_cover_tex.gui_input.connect(_on_cover_card_input)
	_cover_tex.mouse_entered.connect(_on_cover_mouse_entered)
	_cover_tex.mouse_exited.connect(_on_deck_card_mouse_exited)
	_cover_panel.add_child(_cover_tex)

	_cover_empty_label = Label.new()
	_cover_empty_label.text = "Optional"
	_cover_empty_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_cover_empty_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_cover_empty_label.add_theme_color_override("font_color", Color(0.7, 0.72, 0.8, 0.9))
	_cover_empty_label.add_theme_font_size_override("font_size", 10)
	_cover_empty_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cover_empty_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cover_tex.add_child(_cover_empty_label)
	_refresh_cover_display()

	var caption := Label.new()
	caption.text = "Cover"
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.add_theme_color_override("font_color", Color(0.62, 0.68, 0.82, 1))
	caption.add_theme_font_size_override("font_size", 11)
	col.add_child(caption)


func _build_color_slot(parent: VBoxContainer, color_name: String) -> void:
	var slot_color: Color = COLOR_VALUES[color_name]
	var slot_panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.07, 0.16, 0.85)
	style.border_color = Color(slot_color.r, slot_color.g, slot_color.b, 0.4)
	style.set_border_width_all(1)
	style.set_corner_radius_all(8)
	style.content_margin_left = 12
	style.content_margin_right = 10
	style.content_margin_top = 7
	style.content_margin_bottom = 8
	slot_panel.add_theme_stylebox_override("panel", style)
	parent.add_child(slot_panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	slot_panel.add_child(vbox)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	vbox.add_child(header)

	var dot := Panel.new()
	dot.custom_minimum_size = Vector2(10, 10)
	dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var dot_style := StyleBoxFlat.new()
	dot_style.bg_color = slot_color
	dot_style.set_corner_radius_all(5)
	dot.add_theme_stylebox_override("panel", dot_style)
	header.add_child(dot)

	var title := Label.new()
	title.text = color_name.capitalize()
	title.add_theme_font_size_override("font_size", 14)
	title.add_theme_color_override("font_color", slot_color.lightened(0.25))
	header.add_child(title)

	var counter := Label.new()
	counter.text = "0 / %d" % MAX_PER_COLOR
	counter.add_theme_font_size_override("font_size", 13)
	counter.add_theme_color_override("font_color", Color(0.62, 0.68, 0.82))
	counter.size_flags_horizontal = Control.SIZE_EXPAND | Control.SIZE_SHRINK_END
	header.add_child(counter)
	_slot_counters[color_name] = counter

	var cards_flow := HFlowContainer.new()
	cards_flow.add_theme_constant_override("h_separation", 4)
	cards_flow.add_theme_constant_override("v_separation", 4)
	cards_flow.custom_minimum_size = Vector2(0, 60)
	vbox.add_child(cards_flow)
	_slot_containers[color_name] = cards_flow
	_refresh_slot_display(color_name)


func _build_card_browser(parent: HBoxContainer) -> void:
	var browser_panel := _section_panel(Color(0.86, 0.72, 0.32, 0.45))
	browser_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	browser_panel.size_flags_stretch_ratio = 1.0
	browser_panel.custom_minimum_size = Vector2(280, 0)
	parent.add_child(browser_panel)

	var browser_vbox := VBoxContainer.new()
	browser_vbox.add_theme_constant_override("separation", 8)
	browser_panel.add_child(browser_vbox)

	var browser_header := HBoxContainer.new()
	browser_header.add_theme_constant_override("separation", 10)
	browser_vbox.add_child(browser_header)

	var browser_title := Label.new()
	browser_title.text = "CARD LIBRARY"
	browser_title.theme_type_variation = &"HeaderLabel"
	browser_header.add_child(browser_title)

	_results_label = Label.new()
	_results_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_results_label.add_theme_font_size_override("font_size", 13)
	_results_label.add_theme_color_override("font_color", FILTER_LABEL_COLOR)
	browser_header.add_child(_results_label)

	var reset_btn := Button.new()
	reset_btn.text = "Reset filters"
	reset_btn.theme_type_variation = &"ToolbarButton"
	reset_btn.pressed.connect(_on_reset_filters)
	browser_header.add_child(reset_btn)

	# Filter row 1: Side, Type, Color
	var filter_row1 := HBoxContainer.new()
	filter_row1.add_theme_constant_override("separation", 8)
	browser_vbox.add_child(filter_row1)

	filter_row1.add_child(_filter_label("Side"))

	_side_filter = OptionButton.new()
	_side_filter.add_item("All")
	_side_filter.add_item("Light")
	_side_filter.add_item("Dark")
	_side_filter.item_selected.connect(_on_filter_changed)
	filter_row1.add_child(_side_filter)
	_style_dropdown(_side_filter)

	filter_row1.add_child(_filter_label("Type"))

	_type_filter = OptionButton.new()
	for t in CARD_TYPES:
		_type_filter.add_item(t)
	_type_filter.item_selected.connect(_on_filter_changed)
	filter_row1.add_child(_type_filter)
	_style_dropdown(_type_filter)

	filter_row1.add_child(_filter_label("Color"))

	_color_filter = OptionButton.new()
	_color_filter.add_item("All")
	for cn in COLOR_NAMES:
		_color_filter.add_item(cn.capitalize())
	_color_filter.add_item("Wild Card")
	_color_filter.item_selected.connect(_on_filter_changed)
	filter_row1.add_child(_color_filter)
	_style_dropdown(_color_filter)

	# Filter row 2: Set, Destiny
	var filter_row2_setdest := HBoxContainer.new()
	filter_row2_setdest.add_theme_constant_override("separation", 8)
	browser_vbox.add_child(filter_row2_setdest)

	filter_row2_setdest.add_child(_filter_label("Set"))

	_set_filter = OptionButton.new()
	_set_filter.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_set_filter.clip_text = true
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
	_style_dropdown(_set_filter)

	filter_row2_setdest.add_child(_filter_label("Destiny"))

	_destiny_filter = OptionButton.new()
	_destiny_filter.add_item("All")
	for d in range(7):
		_destiny_filter.add_item(str(d))
	_destiny_filter.item_selected.connect(_on_filter_changed)
	filter_row2_setdest.add_child(_destiny_filter)
	_style_dropdown(_destiny_filter)

	filter_row2_setdest.add_child(_filter_label("Trait"))

	_trait_filter = OptionButton.new()
	_trait_filter.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_trait_filter.clip_text = true
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
	_style_dropdown(_trait_filter)

	# Filter row 3: Title search, Gametext search
	var filter_row2 := HBoxContainer.new()
	filter_row2.add_theme_constant_override("separation", 8)
	browser_vbox.add_child(filter_row2)

	filter_row2.add_child(_filter_label("Title"))

	_title_search = LineEdit.new()
	_title_search.placeholder_text = "Search title..."
	_title_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title_search.clear_button_enabled = true
	_title_search.text_changed.connect(_on_filter_text_changed)
	filter_row2.add_child(_title_search)

	filter_row2.add_child(_filter_label("Text"))

	_gametext_search = LineEdit.new()
	_gametext_search.placeholder_text = "Search gametext..."
	_gametext_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_gametext_search.clear_button_enabled = true
	_gametext_search.text_changed.connect(_on_filter_text_changed)
	filter_row2.add_child(_gametext_search)

	var divider := HSeparator.new()
	divider.add_theme_constant_override("separation", 4)
	browser_vbox.add_child(divider)

	_card_scroll = ScrollContainer.new()
	_card_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_card_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_card_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_card_scroll.resized.connect(_fit_card_grid_columns)
	browser_vbox.add_child(_card_scroll)

	_card_grid = GridContainer.new()
	_card_grid.columns = 2
	_card_grid.add_theme_constant_override("h_separation", GRID_SPACING)
	_card_grid.add_theme_constant_override("v_separation", GRID_SPACING)
	_card_grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER | Control.SIZE_EXPAND
	_card_scroll.add_child(_card_grid)


func _fit_card_grid_columns() -> void:
	var usable := _card_scroll.size.x - 14.0
	var cols := int(floor((usable + GRID_SPACING) / float(CARD_WIDTH + GRID_SPACING)))
	cols = maxi(cols, 2)
	if _card_grid.columns != cols:
		_card_grid.columns = cols


func _filter_label(text: String) -> Label:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", 13)
	lbl.add_theme_color_override("font_color", FILTER_LABEL_COLOR)
	return lbl


func _on_reset_filters() -> void:
	for ob in [_side_filter, _type_filter, _color_filter, _set_filter, _destiny_filter, _trait_filter]:
		ob.select(0)
	_title_search.text = ""
	_gametext_search.text = ""
	_apply_filters()


func _style_dropdown(btn: OptionButton) -> void:
	DropdownStyle.apply(btn, GOLD, DECK_THEME)


func _themed_dialog(dialog: Window) -> void:
	dialog.theme = DECK_THEME


func _populate_card_grid() -> void:
	for c in _card_grid.get_children():
		c.queue_free()

	var shown := 0
	for card in _filtered_cards:
		var card_id: String = card.get("id", "")
		var side: String = card.get("side", "")
		if card_id.is_empty():
			continue

		var tex := _load_card_texture(card_id, side, str(card.get("set", "")), card)
		if tex == null:
			_card_grid.add_child(_create_missing_card(card))
		else:
			_card_grid.add_child(_create_draggable_card(card, tex))
		shown += 1

	if _results_label:
		_results_label.text = "%d card%s" % [shown, "" if shown == 1 else "s"]
	if shown == 0:
		var empty := Label.new()
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		empty.custom_minimum_size = Vector2(240, 60)
		empty.add_theme_color_override("font_color", Color(0.95, 0.82, 0.35))
		if _all_cards.is_empty():
			empty.text = "No cards loaded. The card list was not in the game pack."
		else:
			empty.text = "No cards match these filters."
		_card_grid.add_child(empty)


func _create_missing_card(card: Dictionary) -> Control:
	var container := Panel.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.12, 0.12, 0.16, 1)
	style.border_color = Color(0.7, 0.55, 0.2)
	style.border_width_bottom = 2
	container.add_theme_stylebox_override("panel", style)
	container.custom_minimum_size = Vector2(CARD_WIDTH, CARD_HEIGHT + 6)
	var label := Label.new()
	label.text = str(card.get("name", card.get("id", "Card")))
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.custom_minimum_size = Vector2(CARD_WIDTH - 8, CARD_HEIGHT)
	label.add_theme_color_override("font_color", Color(0.9, 0.9, 0.9))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	container.add_child(label)
	container.set_meta("card_data", card)
	container.gui_input.connect(_on_card_gui_input.bind(container))
	return container


func _create_draggable_card(card: Dictionary, tex: Texture2D) -> Control:
	var container := Panel.new()
	var style := StyleBoxFlat.new()
	if _is_wild_card(card):
		style.border_color = Color(0.95, 0.95, 0.95)
	else:
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
	var tex := _load_card_texture(card_id, side, str(card.get("set", "")), card)
	if tex == null:
		return

	var popup := PanelContainer.new()
	popup.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var popup_style := StyleBoxFlat.new()
	popup_style.bg_color = Color(0.03, 0.05, 0.12, 0.96)
	popup_style.border_color = Color(0.86, 0.72, 0.32, 0.9)
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
	var tex: Texture2D = card_panel.get_meta("card_texture") if card_panel.has_meta("card_texture") else null
	if tex == null:
		tex = _load_card_texture(str(card.get("id", "")), str(card.get("side", "")), str(card.get("set", "")), card)
	_drag_preview_card = card
	_hide_hover_preview()

	_drag_overlay = TextureRect.new()
	_drag_overlay.texture = tex
	_drag_overlay.custom_minimum_size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	_drag_overlay.size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	_drag_overlay.size_flags_horizontal = 0
	_drag_overlay.size_flags_vertical = 0
	_drag_overlay.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_drag_overlay.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_drag_overlay.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_drag_overlay.modulate = Color(1, 1, 1, 0.85)
	_drag_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_drag_overlay.z_index = 100
	_drag_overlay.set_as_top_level(true)
	add_child(_drag_overlay)
	_drag_overlay.size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	_drag_offset = Vector2(CARD_WIDTH / 2.0, CARD_HEIGHT / 2.0)
	_drag_overlay.global_position = gpos - _drag_offset

func _end_drag(gpos: Vector2) -> void:
	_dragging = false
	if _drag_overlay:
		_drag_overlay.queue_free()
		_drag_overlay = null

	var card: Dictionary = _drag_preview_card
	var dropped_target := _get_drop_target(gpos)
	if dropped_target == "cover":
		_set_cover_card(card)
		_drag_source = null
		_drag_preview_card = {}
		return

	if dropped_target.is_empty():
		_show_toast("Drag card to a color slot, or onto Cover for table art.")
		return

	var allowed := _card_allowed_colors(card)
	if dropped_target not in allowed:
		if _is_wild_card(card):
			_show_toast("This wild card can go in: %s." % _join_color_names(allowed))
		else:
			var dot_color: String = card.get("dotColor", "")
			_show_toast("This card is %s — it must go in the %s slot." % [dot_color.capitalize(), dot_color.capitalize()])
		return

	_try_add_card_to_slot(card, dropped_target)
	_drag_source = null
	_drag_preview_card = {}


func _card_allowed_colors(card: Dictionary) -> Array[String]:
	var out: Array[String] = []
	var listed: Variant = card.get("dotColors", [])
	if listed is Array:
		for c in listed:
			var name_str := str(c)
			if COLOR_NAMES.has(name_str) and name_str not in out:
				out.append(name_str)
	if out.size() >= 2:
		return out
	var single: String = card.get("dotColor", "")
	if COLOR_NAMES.has(single):
		var one: Array[String] = []
		one.append(single)
		return one
	return out


func _is_wild_card(card: Dictionary) -> bool:
	return _card_allowed_colors(card).size() >= 2


func _slot_has_wild(color_name: String) -> bool:
	for c in _deck_slots[color_name]:
		if _is_wild_card(c):
			return true
	return false


func _join_color_names(colors: Array[String]) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for c in colors:
		parts.append(c.capitalize())
	return ", ".join(parts)


func _add_card_to_deck(card: Dictionary) -> void:
	var allowed := _card_allowed_colors(card)
	if allowed.is_empty():
		_show_toast("This card has no valid color.")
		return
	if allowed.size() == 1:
		_try_add_card_to_slot(card, allowed[0])
		return
	for color_name in allowed:
		if _deck_slots[color_name].size() < MAX_PER_COLOR and not _slot_has_wild(color_name):
			_try_add_card_to_slot(card, color_name)
			return
	_show_toast("No open color for this wild card (one wild per color, 10 cards max).")


func _try_add_card_to_slot(card: Dictionary, color_name: String) -> void:
	var deck_side: String = _get_deck_side()
	var card_side: String = card.get("side", "")
	if not deck_side.is_empty() and card_side != deck_side:
		_show_toast("You can't play cards from both Light and Dark side in a deck.")
		return

	var allowed := _card_allowed_colors(card)
	if color_name not in allowed:
		if _is_wild_card(card):
			_show_toast("This wild card can go in: %s." % _join_color_names(allowed))
		else:
			_show_toast("This card is %s — it must go in the %s slot." % [card.get("dotColor", "").capitalize(), color_name.capitalize()])
		return

	if _is_wild_card(card) and _slot_has_wild(color_name):
		_show_toast("Already have a wild card in %s (only one wild per color)." % color_name.capitalize())
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
	if _is_wild_card(card):
		_show_toast("Added wild card %s to %s slot." % [card_name, color_name.capitalize()])
	else:
		_show_toast("Added %s to %s slot." % [card_name, color_name.capitalize()])


func _set_cover_card(card: Dictionary) -> void:
	_cover_card = card.duplicate(true)
	_refresh_cover_display()
	_show_toast("Cover set to %s. This is table art only." % card.get("name", "this card"))


func _refresh_cover_display() -> void:
	if _cover_tex == null:
		return
	var cid: String = str(_cover_card.get("id", ""))
	if cid.is_empty():
		_cover_tex.texture = null
		if _cover_empty_label:
			_cover_empty_label.visible = true
		_cover_tex.tooltip_text = "Optional cover — drag a card here for table art"
		return
	var side: String = str(_cover_card.get("side", ""))
	var tex := _load_card_texture(cid, side, str(_cover_card.get("set", "")), _cover_card)
	_cover_tex.texture = tex
	if _cover_empty_label:
		_cover_empty_label.visible = tex == null
	_cover_tex.tooltip_text = "%s (cover — click to remove)" % _cover_card.get("name", "Cover")


func _on_cover_mouse_entered() -> void:
	if _cover_card.is_empty():
		return
	_on_deck_card_mouse_entered(_cover_card)


func _on_cover_card_input(event: InputEvent) -> void:
	if _cover_card.is_empty():
		return
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT or event.button_index == MOUSE_BUTTON_RIGHT:
			var name_str: String = str(_cover_card.get("name", "cover"))
			_cover_card = {}
			_hide_hover_preview()
			_refresh_cover_display()
			_show_toast("Removed cover card (%s)." % name_str)


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


func _missing_location_planets() -> Array[String]:
	var found: Dictionary = {}
	for loc in _get_all_locations_in_deck():
		var planet: String = str(loc.get("planet", "")).strip_edges()
		if planet in REQUIRED_LOCATION_PLANETS:
			found[planet] = true
	var missing: Array[String] = []
	for required in REQUIRED_LOCATION_PLANETS:
		if not found.get(required, false):
			missing.append(required)
	return missing


func _has_required_locations() -> bool:
	return _missing_location_planets().is_empty()


func _update_location_warning() -> void:
	if _location_warning_label == null:
		return
	var missing := _missing_location_planets()
	if missing.is_empty():
		_location_warning_label.text = "Locations: Tatooine, Naboo, and Coruscant."
		_location_warning_label.add_theme_color_override("font_color", Color(0.55, 0.85, 0.6, 1))
	else:
		_location_warning_label.text = "Need a location from: %s." % ", ".join(missing)
		_location_warning_label.add_theme_color_override("font_color", Color(1.0, 0.62, 0.32, 1))


func _get_drop_target(gpos: Vector2) -> String:
	if _cover_panel and _cover_panel.get_global_rect().has_point(gpos):
		return "cover"
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
		var count_text := "%d card%s" % [card_count, "" if card_count == 1 else "s"]
		if card_count == 0:
			_deck_avg_destiny_label.text = "%s   ·   Average Destiny —" % count_text
		else:
			var avg: float = total_destiny / float(card_count)
			var display: String
			if abs(avg - roundf(avg)) < 0.001:
				display = "%d" % int(roundf(avg))
			else:
				display = "%.1f" % avg
			_deck_avg_destiny_label.text = "%s   ·   Average Destiny %s" % [count_text, display]


func _refresh_slot_display(color_name: String) -> void:
	var container: HFlowContainer = _slot_containers[color_name]
	for c in container.get_children():
		c.queue_free()

	var cards: Array = _deck_slots[color_name]
	var counter: Label = _slot_counters[color_name]
	counter.text = "%d / %d" % [cards.size(), MAX_PER_COLOR]
	counter.add_theme_color_override("font_color", GOLD if cards.size() >= MAX_PER_COLOR else FILTER_LABEL_COLOR)
	_update_average_destiny()
	_update_location_warning()

	if cards.is_empty():
		var hint := Label.new()
		hint.text = "Drag cards here"
		hint.custom_minimum_size = Vector2(0, 60)
		hint.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		hint.add_theme_font_size_override("font_size", 12)
		hint.add_theme_color_override("font_color", Color(0.5, 0.56, 0.7, 0.7))
		hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
		container.add_child(hint)

	for i in range(cards.size()):
		var card: Dictionary = cards[i]
		var card_id: String = card.get("id", "")
		var side: String = card.get("side", "")
		var tex := _load_card_texture(card_id, side, str(card.get("set", "")), card)
		if tex == null:
			continue

		var card_tex := TextureRect.new()
		card_tex.texture = tex
		card_tex.custom_minimum_size = Vector2(42, 60)
		card_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		card_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		card_tex.tooltip_text = ""
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
	var wild_only := false
	if color_idx == COLOR_NAMES.size() + 1:
		wild_only = true
	elif color_idx > 0 and color_idx <= COLOR_NAMES.size():
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
		if wild_only and not _is_wild_card(card):
			continue
		if not color_filter.is_empty() and color_filter not in _card_allowed_colors(card):
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
			var lore_text: String = str(card.get("lore", "")).to_lower()
			var gt_text: String = str(card.get("gametext", "")).to_lower()
			if lore_text.find(gametext_text) == -1 and gt_text.find(gametext_text) == -1:
				continue
		_filtered_cards.append(card)

	if not color_filter.is_empty():
		_filtered_cards.sort_custom(func(a, b):
			var a_wild: bool = _is_wild_card(a)
			var b_wild: bool = _is_wild_card(b)
			if a_wild != b_wild:
				return a_wild
			return str(a.get("name", "")) < str(b.get("name", ""))
		)

	_populate_card_grid()


# --- Deck management ---

func _on_new_deck() -> void:
	_deck_name = "New Deck"
	_deck_name_label.text = _deck_name
	_cover_card = {}
	_refresh_cover_display()
	for c in COLOR_NAMES:
		_deck_slots[c].clear()
		_refresh_slot_display(c)
	_update_average_destiny()
	_update_location_warning()


func _on_save_deck() -> void:
	if not _has_required_locations():
		var missing := _missing_location_planets()
		_show_toast("You need one location from each of Tatooine, Naboo, and Coruscant. Missing: %s." % ", ".join(missing))
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
	_themed_dialog(dialog)
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
	if not _cover_card.is_empty() and not str(_cover_card.get("id", "")).is_empty():
		deck_data["coverCard"] = {
			"id": _cover_card.get("id", ""),
			"set": _cover_card.get("set", "menaceofdarthmaul")
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
	_themed_dialog(dialog)
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

	_cover_card = {}
	var cover_raw: Variant = deck.get("coverCard", {})
	if cover_raw is Dictionary:
		var cid: String = str(cover_raw.get("id", ""))
		var set_hint: String = str(cover_raw.get("set", "menaceofdarthmaul"))
		if not cid.is_empty():
			var info: Dictionary = CardCatalog.get_card_info(cid, "", set_hint)
			if not info.is_empty():
				_cover_card = info
	_refresh_cover_display()

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
	_themed_dialog(dialog)
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


func _load_card_texture(card_id: String, side: String, set_hint: String = "", _card: Dictionary = {}) -> Texture2D:
	return CardArt.load_texture(card_id, side, set_hint)


var _toast_label: Control = null

func _show_toast(message: String) -> void:
	if _toast_label and is_instance_valid(_toast_label):
		_toast_label.queue_free()

	var holder := CenterContainer.new()
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.set_anchors_and_offsets_preset(PRESET_BOTTOM_WIDE)
	holder.offset_top = -64
	holder.offset_bottom = -22
	add_child(holder)

	var pill := PanelContainer.new()
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.03, 0.05, 0.12, 0.95)
	s.border_color = Color(0.86, 0.72, 0.32, 0.85)
	s.set_border_width_all(1)
	s.set_corner_radius_all(16)
	s.content_margin_left = 18
	s.content_margin_right = 18
	s.content_margin_top = 7
	s.content_margin_bottom = 7
	s.shadow_color = Color(0, 0, 0, 0.5)
	s.shadow_size = 8
	pill.add_theme_stylebox_override("panel", s)
	holder.add_child(pill)

	var label := Label.new()
	label.text = message
	label.add_theme_font_size_override("font_size", 14)
	label.add_theme_color_override("font_color", Color(0.98, 0.93, 0.75))
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if message.length() > 70:
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size = Vector2(520, 0)
	pill.add_child(label)
	_toast_label = holder

	var toast := holder
	get_tree().create_timer(3.0).timeout.connect(func():
		if is_instance_valid(toast):
			toast.queue_free()
		if _toast_label == toast:
			_toast_label = null
	)
