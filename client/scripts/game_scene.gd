## In-game scene: hand, table (in-play), phase/turn, play card / pass / battle.
## Player always at bottom (your deck + hand + in play), opponent at top (their deck + in play).
extends Control

const CardPlaceholderScene = preload("res://scenes/card_placeholder.tscn")
const BattlePlanCardScene = preload("res://scenes/battle_plan_card.tscn")
var CARD_BACK_LIGHT: Texture2D = preload("res://assets/card_back_light.png")
var CARD_BACK_DARK: Texture2D = preload("res://assets/card_back_dark.png")

@onready var phase_label: Label = %PhaseLabel
@onready var opp_discard_wrapper: Control = %OppDiscardWrapper
@onready var opp_discard: TextureRect = %OppDiscard
@onready var opp_discard_label: Label = %OppDiscardLabel
@onready var opp_deck_wrapper: Control = %OppDeckWrapper
@onready var opp_deck: TextureRect = %OppDeck
@onready var opp_deck_count_label: Label = %OppDeckCount
@onready var opp_deck_label: Label = %OppDeckLabel
@onready var your_deck_label: Label = %YourDeckLabel
@onready var your_discard_wrapper: Control = %YourDiscardPileWrapper
@onready var your_discard: TextureRect = %YourDiscardPile
@onready var your_discard_label: Label = %YourDiscardLabel
@onready var your_deck_wrapper: Control = %YourDeckWrapper
@onready var your_deck: TextureRect = %YourDeck
@onready var your_deck_count_label: Label = %YourDeckCount
@onready var hand_label: Label = %HandLabel
@onready var hand_container: HBoxContainer = %HandList
@onready var your_play_container: HBoxContainer = %YourInPlayRow
@onready var opp_play_container: HBoxContainer = %OpponentInPlayRow
@onready var play_card_btn: Button = %PlayCardBtn
@onready var pass_phase_btn: Button = %PassPhaseBtn
@onready var battle_btn: Button = %BattleBtn
@onready var discard_hand_btn: Button = %DiscardHandBtn
@onready var even_up_btn: Button = %EvenUpBtn
@onready var discard_location_btn: Button = %DiscardLocationBtn
@onready var evacuate_btn: Button = %EvacuateBtn
@onready var duel_btn: Button = %DuelBtn
@onready var your_hs_wrapper: Control = %YourHyperspaceWrapper
@onready var your_hs_tex: TextureRect = %YourHyperspace
@onready var your_hs_count: Label = %YourHyperspaceCount
@onready var opp_hs_wrapper: Control = %OppHyperspaceWrapper
@onready var opp_hs_tex: TextureRect = %OppHyperspace
@onready var opp_hs_count: Label = %OppHyperspaceCount
@onready var surrender_planet_btn: Button = %SurrenderPlanetBtn
@onready var concede_btn: Button = %ConcedeBtn
@onready var return_to_lobby_btn: Button = %ReturnToLobbyBtn
@onready var status_label: Label = %StatusLabel
@onready var destiny_compare_section: Control = %DestinyCompareSection
@onready var destiny_compare_label: RichTextLabel = %DestinyCompareLabel
@onready var your_destiny_caption: Label = %YourDestinyCaption
@onready var opp_destiny_caption: Label = %OppDestinyCaption
@onready var opponent_destiny_slot: HBoxContainer = %OpponentDestinySlot
@onready var your_destiny_slot: HBoxContainer = %YourDestinySlot
@onready var location_row: Control = %LocationRow
@onready var starting_location_label: Label = %StartingLocationLabel
@onready var starting_location_slot: CenterContainer = %StartingLocationSlot
@onready var location_choice_section: Control = %LocationChoiceSection
@onready var location_choice_label: Label = %LocationChoiceLabel
@onready var location_choice_hint: Label = %LocationChoiceHint
@onready var location_choice_cards: HBoxContainer = %LocationChoiceCards
@onready var location_choice_scroll: ScrollContainer = %LocationChoiceScroll
@onready var battle_plan_section: VBoxContainer = %BattlePlanSection
@onready var battle_plan_label: Label = %BattlePlanLabel
@onready var battle_plan_row: HBoxContainer = %BattlePlanRow
@onready var battle_plan_ready_btn: Button = %BattlePlanReadyBtn
@onready var opponent_hand_container: HBoxContainer = %OpponentHandContainer
@onready var opp_corner: HBoxContainer = %OppCorner
@onready var your_corner: VBoxContainer = %YourCorner
@onready var actions_panel: PanelContainer = %ActionsPanel
@onready var actions_right: VBoxContainer = %ActionsRight
@onready var chat_panel: PanelContainer = %ChatPanel
@onready var chat_toggle_btn: Button = %ChatToggleBtn
@onready var chat_messages: VBoxContainer = %Messages
@onready var chat_scroll: ScrollContainer = %ChatScroll
@onready var chat_input: LineEdit = %ChatInput
@onready var chat_send_btn: Button = %ChatSendBtn

var _selected_instance_id: String = ""
var _discard_location_mode: bool = false
var _destiny_animation_done: bool = false
var _destiny_flying: bool = false
var _previous_phase: String = ""
var _initial_draw_animation_done: bool = false
var _your_deck_count: int = 0
var _opp_deck_count: int = 0
var _chat_send_frame: int = -1

const DECK_POPUP_CARD_SIZE := Vector2(120, 170)
var _deck_popup_yours: PanelContainer = null
var _deck_popup_opp: PanelContainer = null
var _deck_popup_hide_timer: Timer = null
var _deck_popup_layer: CanvasLayer = null

const DISCARD_POPUP_CARD_SIZE := Vector2(120, 170)
var _discard_popup_yours: PanelContainer = null
var _discard_popup_opp: PanelContainer = null
var _discard_popup_hide_timer: Timer = null
var _discard_popup_layer: CanvasLayer = null
var _your_discard_count_cached: int = 0
var _opp_discard_count_cached: int = 0
var _your_discard_top_texture: Texture2D = null
var _opp_discard_top_texture: Texture2D = null

var _game_over_layer: CanvasLayer = null
var _pending_game_over: Dictionary = {}
var _last_game_ended_payload: Dictionary = {}
var _game_over_received: bool = false

var _controlled_planets_layer: CanvasLayer = null
var _controlled_planets_panel: PanelContainer = null
var _stranded_popup_layer: CanvasLayer = null
var _stranded_popup_panel: PanelContainer = null
var _stranded_popup_planet_index: int = -1
var _win_control_selected: Array = []
var _win_control_needed: int = 0

var _dragging_instance_id: String = ""
var _drag_preview: Control = null
var _drag_preview_layer: CanvasLayer = null
var _battle_plan_order: Array = []  # instance ids left-to-right for battle plan
var _battle_cards_in_plan: Array = []  # battle card instance ids added from hand
var _declared_battle_cards: Array = []  # battle card instance ids staged during declaration phase
var _dragging_from_battle_plan: bool = false
var _effect_decline_btn: Button = null
var _battle_reveal_sequence: Array = []
var _battle_reveal_index: int = 0
var _battle_reveal_overlay: CanvasLayer = null
var _battle_reveal_panel: PanelContainer = null
var _battle_reveal_timer: Timer = null
var _battle_mill_queue: Array = []
var _battle_mill_index: int = 0
var _battle_mill_side: String = ""
const BATTLE_REVEAL_DELAY_SEC: float = 10.0

var _evacuation_overlay: CanvasLayer = null
var _evacuation_panel: PanelContainer = null
var _dotf_overlay: CanvasLayer = null
var _dotf_overlay_kind: String = ""
var _damage_replace_key: String = ""
var _hs_browse_overlay: CanvasLayer = null
var _picking_duel: bool = false
var _duel_char_id: String = ""
var _duel_weapon_id: String = ""
var _seen_duel_result: String = ""
var _duel_prev: Dictionary = {}
var _duel_flash: Dictionary = {}
var _duel_flash_serial: int = 0
const DUEL_FLASH_SECS := 2.6
const DUEL_HIT_COLOR := Color(1.0, 0.38, 0.32)
const DUEL_GOLD := Color(1.0, 0.84, 0.36)
const DUEL_MUTED := Color(0.62, 0.68, 0.82)
var _setup_fly_layer: CanvasLayer = null

var _announced_opp_battle_cards: bool = false


func _ready() -> void:
	if CardCatalog and CardCatalog.has_method("smooth_texture"):
		var sharp_light: Texture2D = CardCatalog.smooth_texture(CARD_BACK_LIGHT)
		var sharp_dark: Texture2D = CardCatalog.smooth_texture(CARD_BACK_DARK)
		if sharp_light != null:
			CARD_BACK_LIGHT = sharp_light
		if sharp_dark != null:
			CARD_BACK_DARK = sharp_dark
	for back_rect in [your_deck, opp_deck, your_discard, opp_discard]:
		if back_rect:
			back_rect.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_lift_setup_banners()
	_build_info_plates()
	_build_pile_frames()
	_style_action_buttons()
	_setup_chat_toggle()
	_fit_board_to_window()
	var board_box: Control = get_node_or_null("HBoxContainer/Margin/GameArea/VBox") as Control
	if board_box and not board_box.resized.is_connected(_fit_board_to_window):
		board_box.resized.connect(_fit_board_to_window)
	var client: RefCounted = Connection.get_client()
	var state: RefCounted = Connection.get_state()
	client.message_received.connect(_on_message)
	state.game_state_updated.connect(_on_game_state)
	state.game_hand.connect(_on_hand)
	state.game_ended.connect(_on_game_ended)
	state.error_received.connect(_on_error)
	state.chat_received.connect(_on_game_chat)
	play_card_btn.pressed.connect(_on_play_card_pressed)
	pass_phase_btn.pressed.connect(_on_pass_pressed)
	battle_btn.pressed.connect(_on_battle_pressed)
	if discard_hand_btn:
		discard_hand_btn.pressed.connect(_on_discard_hand_pressed)
	if even_up_btn:
		even_up_btn.pressed.connect(_on_even_up_pressed)
	if discard_location_btn:
		discard_location_btn.pressed.connect(_on_discard_location_pressed)
	if evacuate_btn:
		evacuate_btn.pressed.connect(_on_evacuate_pressed)
	if duel_btn:
		duel_btn.pressed.connect(_on_duel_pressed)
	if your_hs_wrapper:
		your_hs_wrapper.gui_input.connect(_on_your_hs_gui_input)
	if opp_hs_wrapper:
		opp_hs_wrapper.gui_input.connect(_on_opp_hs_gui_input)
	if surrender_planet_btn:
		surrender_planet_btn.pressed.connect(_on_surrender_planet_pressed)
	concede_btn.pressed.connect(_on_concede_pressed)
	if chat_toggle_btn:
		chat_toggle_btn.toggled.connect(_on_chat_toggled)
	if return_to_lobby_btn:
		return_to_lobby_btn.pressed.connect(_on_return_to_lobby_pressed)
	_ensure_effect_decline_btn()
	if battle_plan_ready_btn:
		battle_plan_ready_btn.pressed.connect(_on_battle_plan_ready_pressed)
		_style_action_button(battle_plan_ready_btn, "primary")
	if chat_send_btn:
		chat_send_btn.pressed.connect(_on_chat_send)
	if chat_input:
		chat_input.text_submitted.connect(_on_chat_submitted)
		chat_input.gui_input.connect(_on_chat_input_gui_input)
	if chat_scroll:
		chat_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		chat_scroll.resized.connect(_refit_chat_lines)
	# Deck hover: connect to wrappers (mouse_filter STOP) so hover is detected
	if opp_deck_wrapper:
		opp_deck_wrapper.mouse_entered.connect(_on_opp_deck_mouse_entered)
		opp_deck_wrapper.mouse_exited.connect(_on_opp_deck_mouse_exited)
	if your_deck_wrapper:
		your_deck_wrapper.mouse_entered.connect(_on_your_deck_mouse_entered)
		your_deck_wrapper.mouse_exited.connect(_on_your_deck_mouse_exited)
	_build_deck_popups()
	_build_discard_popups()
	_build_controlled_planets_panel()
	_build_stranded_popup()
	if your_discard_wrapper:
		your_discard_wrapper.mouse_entered.connect(_on_your_discard_mouse_entered)
		your_discard_wrapper.mouse_exited.connect(_on_your_discard_mouse_exited)
	if opp_discard_wrapper:
		opp_discard_wrapper.mouse_entered.connect(_on_opp_discard_mouse_entered)
		opp_discard_wrapper.mouse_exited.connect(_on_opp_discard_mouse_exited)
	_refresh()


func _build_deck_popups() -> void:
	_deck_popup_layer = CanvasLayer.new()
	_deck_popup_layer.layer = 100
	add_child(_deck_popup_layer)

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.15, 0.18, 0.25, 0.98)
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.4, 0.5, 0.7, 1)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.set_content_margin_all(10)

	_deck_popup_yours = _make_one_deck_popup(style)
	_deck_popup_layer.add_child(_deck_popup_yours)
	_deck_popup_yours.mouse_entered.connect(_cancel_deck_popup_hide)
	_deck_popup_yours.mouse_exited.connect(_schedule_deck_popup_hide)

	_deck_popup_opp = _make_one_deck_popup(style)
	_deck_popup_layer.add_child(_deck_popup_opp)
	_deck_popup_opp.mouse_entered.connect(_cancel_deck_popup_hide)
	_deck_popup_opp.mouse_exited.connect(_schedule_deck_popup_hide)

	_deck_popup_hide_timer = Timer.new()
	_deck_popup_hide_timer.one_shot = true
	_deck_popup_hide_timer.wait_time = 0.25
	_deck_popup_hide_timer.timeout.connect(_hide_deck_popups)
	add_child(_deck_popup_hide_timer)


func _make_one_deck_popup(style: StyleBoxFlat) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", style)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.visible = false
	panel.custom_minimum_size = Vector2(DECK_POPUP_CARD_SIZE.x + 40, DECK_POPUP_CARD_SIZE.y + 50)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	panel.add_child(vbox)
	var tex := TextureRect.new()
	tex.custom_minimum_size = DECK_POPUP_CARD_SIZE
	tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	vbox.add_child(tex)
	var label := Label.new()
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 16)
	label.add_theme_color_override("font_color", Color(0.95, 0.9, 0.85, 1))
	vbox.add_child(label)
	panel.set_meta("card_texture", tex)
	panel.set_meta("count_label", label)
	return panel


func _cancel_deck_popup_hide() -> void:
	if _deck_popup_hide_timer:
		_deck_popup_hide_timer.stop()


func _schedule_deck_popup_hide() -> void:
	if _deck_popup_hide_timer:
		_deck_popup_hide_timer.start()


func _hide_deck_popups() -> void:
	if _deck_popup_yours:
		_deck_popup_yours.visible = false
	if _deck_popup_opp:
		_deck_popup_opp.visible = false


func _build_discard_popups() -> void:
	_discard_popup_layer = CanvasLayer.new()
	_discard_popup_layer.layer = 99
	add_child(_discard_popup_layer)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.15, 0.18, 0.25, 0.98)
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.4, 0.5, 0.7, 1)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.set_content_margin_all(10)
	_discard_popup_yours = _make_one_discard_popup(style)
	_discard_popup_layer.add_child(_discard_popup_yours)
	_discard_popup_yours.mouse_entered.connect(_cancel_discard_popup_hide)
	_discard_popup_yours.mouse_exited.connect(_schedule_discard_popup_hide)
	_discard_popup_opp = _make_one_discard_popup(style)
	_discard_popup_layer.add_child(_discard_popup_opp)
	_discard_popup_opp.mouse_entered.connect(_cancel_discard_popup_hide)
	_discard_popup_opp.mouse_exited.connect(_schedule_discard_popup_hide)
	_discard_popup_hide_timer = Timer.new()
	_discard_popup_hide_timer.one_shot = true
	_discard_popup_hide_timer.wait_time = 0.25
	_discard_popup_hide_timer.timeout.connect(_hide_discard_popups)
	add_child(_discard_popup_hide_timer)


func _make_one_discard_popup(style: StyleBoxFlat) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", style)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.visible = false
	panel.custom_minimum_size = Vector2(DISCARD_POPUP_CARD_SIZE.x + 40, DISCARD_POPUP_CARD_SIZE.y + 50)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	panel.add_child(vbox)
	var tex := TextureRect.new()
	tex.custom_minimum_size = DISCARD_POPUP_CARD_SIZE
	tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	vbox.add_child(tex)
	var label := Label.new()
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 16)
	label.add_theme_color_override("font_color", Color(0.95, 0.9, 0.85, 1))
	vbox.add_child(label)
	panel.set_meta("card_texture", tex)
	panel.set_meta("count_label", label)
	return panel


func _build_controlled_planets_panel() -> void:
	_controlled_planets_layer = CanvasLayer.new()
	_controlled_planets_layer.layer = 50
	add_child(_controlled_planets_layer)
	_controlled_planets_panel = PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.12, 0.88)
	style.set_border_width_all(1)
	style.border_color = Color(0.18, 0.38, 0.65, 0.8)
	style.set_corner_radius_all(8)
	style.set_content_margin_all(8)
	_controlled_planets_panel.add_theme_stylebox_override("panel", style)
	_controlled_planets_panel.set_anchors_preset(Control.PRESET_CENTER_LEFT)
	_controlled_planets_panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	_controlled_planets_panel.offset_left = 14
	_controlled_planets_panel.visible = false
	_controlled_planets_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	var vbox := VBoxContainer.new()
	vbox.name = "ControlledPlanetsVBox"
	vbox.add_theme_constant_override("separation", 4)
	_controlled_planets_panel.add_child(vbox)
	_controlled_planets_layer.add_child(_controlled_planets_panel)


func _build_stranded_popup() -> void:
	_stranded_popup_layer = CanvasLayer.new()
	_stranded_popup_layer.layer = 210
	add_child(_stranded_popup_layer)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.05, 0.05, 0.15, 0.85)
	bg.mouse_filter = Control.MOUSE_FILTER_STOP
	bg.gui_input.connect(_on_stranded_popup_bg_input)
	_stranded_popup_layer.add_child(bg)
	_stranded_popup_panel = PanelContainer.new()
	_stranded_popup_panel.set_anchors_preset(Control.PRESET_CENTER)
	_stranded_popup_panel.offset_left = -280
	_stranded_popup_panel.offset_top = -240
	_stranded_popup_panel.offset_right = 280
	_stranded_popup_panel.offset_bottom = 240
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.15, 0.18, 0.26, 0.98)
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.5, 0.6, 0.8, 1)
	style.corner_radius_top_left = 10
	style.corner_radius_top_right = 10
	style.corner_radius_bottom_left = 10
	style.corner_radius_bottom_right = 10
	style.set_content_margin_all(16)
	_stranded_popup_panel.add_theme_stylebox_override("panel", style)
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_stranded_popup_panel.add_child(scroll)
	var vbox := VBoxContainer.new()
	vbox.name = "StrandedContent"
	vbox.add_theme_constant_override("separation", 10)
	scroll.add_child(vbox)
	_stranded_popup_layer.add_child(_stranded_popup_panel)
	_stranded_popup_layer.visible = false


func _on_stranded_popup_bg_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		_stranded_popup_layer.visible = false


func _update_controlled_planets_display(pub: Dictionary) -> void:
	if not _controlled_planets_panel:
		return
	var planets: Array = pub.get("controlledPlanets", [])
	var vbox: VBoxContainer = _controlled_planets_panel.find_child("ControlledPlanetsVBox", false, false) as VBoxContainer
	if not vbox:
		return
	for c in vbox.get_children():
		c.queue_free()
	if planets.is_empty():
		_controlled_planets_panel.visible = false
		return
	_controlled_planets_panel.visible = true
	var title := Label.new()
	title.text = "Controlled Planets"
	title.add_theme_font_size_override("font_size", 11)
	title.add_theme_color_override("font_color", Color(0.7, 0.75, 0.9, 1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)
	for i in range(planets.size()):
		var planet_data: Dictionary = planets[i]
		var planet_index: int = i
		var loc_card_id: String = planet_data.get("locationCardId", "")
		var winner: String = planet_data.get("controlledBy", "")
		var planet_name: String = planet_data.get("planet", "")
		var wrapper := Control.new()
		wrapper.custom_minimum_size = Vector2(70, 100)
		wrapper.mouse_filter = Control.MOUSE_FILTER_STOP
		var tex := TextureRect.new()
		tex.set_anchors_preset(Control.PRESET_FULL_RECT)
		tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		tex.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if loc_card_id and CardCatalog:
			var paths_to_try: Array[String] = CardCatalog.get_card_image_paths(loc_card_id, "")
			for p in paths_to_try:
				var loaded_tex: Texture2D = load(p) as Texture2D
				if loaded_tex:
					tex.texture = loaded_tex
					break
		if not tex.texture:
			tex.texture = CARD_BACK_LIGHT
		wrapper.add_child(tex)
		var overlay := ColorRect.new()
		overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
		overlay.color = Color(0, 0, 0, 0.35)
		overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
		wrapper.add_child(overlay)
		var winner_label := Label.new()
		winner_label.set_anchors_preset(Control.PRESET_CENTER)
		winner_label.offset_left = -30
		winner_label.offset_top = -12
		winner_label.offset_right = 30
		winner_label.offset_bottom = 12
		winner_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		winner_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		winner_label.add_theme_font_size_override("font_size", 14)
		if winner == "light":
			winner_label.text = "LIGHT"
			winner_label.add_theme_color_override("font_color", Color(0.3, 0.6, 1.0, 1))
		else:
			winner_label.text = "DARK"
			winner_label.add_theme_color_override("font_color", Color(1.0, 0.2, 0.2, 1))
		wrapper.add_child(winner_label)
		if planet_name:
			var planet_label := Label.new()
			planet_label.text = planet_name
			planet_label.add_theme_font_size_override("font_size", 9)
			planet_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.9, 0.9))
			planet_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			planet_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
			planet_label.offset_top = -16
			wrapper.add_child(planet_label)
		var pd: Dictionary = planet_data
		wrapper.gui_input.connect(func(event: InputEvent) -> void:
			if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
				_show_stranded_cards(pd, planet_index)
		)
		vbox.add_child(wrapper)


func _leading_int(text: String) -> int:
	var digits := ""
	for i in range(text.length()):
		var ch := text.substr(i, 1)
		if ch >= "0" and ch <= "9":
			digits += ch
		else:
			break
	return digits.to_int() if not digits.is_empty() else 0


func _win_control_count(card_id: String, marker: String) -> int:
	if not CardCatalog:
		return -1
	var bonus := str(CardCatalog.get_card_info(card_id, "").get("gametextbonus", "")).to_lower().replace(" ", "")
	if not bonus.contains("wincontrol"):
		return -1
	var i := bonus.find(marker)
	if i < 0:
		return 0
	return _leading_int(bonus.substr(i + marker.length()))


func _win_control_hand_cost(card_id: String) -> int:
	return _win_control_count(card_id, "discardhand:")


func _show_stranded_cards(planet_data: Dictionary, planet_index: int = -1) -> void:
	if not _stranded_popup_layer or not _stranded_popup_panel:
		return
	_stranded_popup_planet_index = planet_index
	var content: VBoxContainer = _stranded_popup_panel.find_child("StrandedContent", true, false) as VBoxContainer
	if not content:
		return
	for c in content.get_children():
		c.queue_free()
	var planet_name: String = planet_data.get("planet", "Unknown")
	var winner: String = planet_data.get("controlledBy", "")
	var loc_card_id: String = planet_data.get("locationCardId", "")
	var state: RefCounted = Connection.get_state()
	var gs: Dictionary = state.game_state if state else {}
	var pub: Dictionary = gs.get("publicState", {}) if state else {}
	var my_side: String = state.game_side if state else ""
	var phase: String = str(gs.get("phase", ""))
	var turn_side: String = str(gs.get("turnSide", ""))
	var hand_n: int = state.hand_with_instances.size() if state else 0
	var pending_busy: bool = pub.get("winControlPending") is Dictionary or pub.get("deployFromDeckPending") is Dictionary or pub.get("duelState") is Dictionary or pub.get("destinySwapPending") is Dictionary
	var title := Label.new()
	var winner_text: String = "LIGHT" if winner == "light" else "DARK"
	title.text = "%s — Controlled by %s" % [planet_name, winner_text]
	title.add_theme_font_size_override("font_size", 18)
	if winner == "light":
		title.add_theme_color_override("font_color", Color(0.3, 0.6, 1.0, 1))
	else:
		title.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3, 1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(title)
	if loc_card_id:
		var loc_section := Label.new()
		loc_section.text = "Location"
		loc_section.add_theme_font_size_override("font_size", 13)
		loc_section.add_theme_color_override("font_color", Color(0.7, 0.75, 0.9, 1))
		content.add_child(loc_section)
		var loc_row := HBoxContainer.new()
		loc_row.alignment = BoxContainer.ALIGNMENT_CENTER
		content.add_child(loc_row)
		var loc_tex := TextureRect.new()
		# Location cards are wide (136x96 aspect); show fully with KEEP_ASPECT so not cropped
		loc_tex.custom_minimum_size = Vector2(220, 155)
		loc_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		loc_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
		var loc_side: String = ""
		if CardCatalog:
			loc_side = CardCatalog.get_card_info(loc_card_id, "").get("side", "light")
		loc_tex.texture = _load_card_texture_for_id(loc_card_id, loc_side)
		loc_row.add_child(loc_tex)
	for side_key in ["strandedLight", "strandedDark"]:
		var cards: Array = planet_data.get(side_key, [])
		if cards.is_empty():
			continue
		var side_name: String = "Light" if side_key == "strandedLight" else "Dark"
		var side_str: String = "light" if side_key == "strandedLight" else "dark"
		var section_label := Label.new()
		section_label.text = "%s Stranded Cards" % side_name
		section_label.add_theme_font_size_override("font_size", 13)
		section_label.add_theme_color_override("font_color", Color(0.7, 0.75, 0.9, 1))
		content.add_child(section_label)
		var cards_row := HBoxContainer.new()
		cards_row.add_theme_constant_override("separation", 6)
		cards_row.alignment = BoxContainer.ALIGNMENT_CENTER
		content.add_child(cards_row)
		for card_data in cards:
			var card_id: String = card_data.get("cardId", "")
			if card_id.is_empty():
				continue
			if CardCatalog:
				var info: Dictionary = CardCatalog.get_card_info(card_id, "")
				if info.get("type", "") == "location":
					continue
			var instance_id: String = str(card_data.get("instanceId", ""))
			var face_down: bool = card_data.get("faceDown", false)
			var needed: int = _win_control_hand_cost(card_id)
			var draw_n: int = _win_control_count(card_id, "draw:")
			var mine_on_won: bool = side_str == my_side and winner == my_side and not face_down and needed >= 0 and not instance_id.is_empty()
			var can_use: bool = mine_on_won and phase == "deploy" and turn_side == my_side and hand_n >= needed and not pending_busy
			var wrap := VBoxContainer.new()
			wrap.add_theme_constant_override("separation", 2)
			var card_btn := Button.new()
			card_btn.custom_minimum_size = Vector2(84, 120)
			card_btn.expand_icon = true
			card_btn.icon = (CARD_BACK_LIGHT if side_str == "light" else CARD_BACK_DARK) if face_down else _load_card_texture_for_id(card_id, side_str)
			wrap.add_child(card_btn)
			if can_use:
				card_btn.modulate = Color(1.2, 1.08, 0.55)
				card_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
				card_btn.tooltip_text = "Discard this character and %d cards from hand, then draw %d" % [needed, draw_n]
				card_btn.pressed.connect(_try_activate_win_control.bind(instance_id, planet_index))
				var hint := Label.new()
				hint.text = "Click to use"
				hint.add_theme_font_size_override("font_size", 10)
				hint.add_theme_color_override("font_color", Color(0.95, 0.85, 0.35, 1))
				hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				wrap.add_child(hint)
			elif mine_on_won and needed > hand_n:
				var hint := Label.new()
				hint.text = "Need %d in hand" % needed
				hint.add_theme_font_size_override("font_size", 10)
				hint.add_theme_color_override("font_color", Color(0.85, 0.55, 0.45, 1))
				hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				wrap.add_child(hint)
			cards_row.add_child(wrap)
	var close_label := Label.new()
	close_label.text = "(click outside to close)"
	close_label.add_theme_font_size_override("font_size", 11)
	close_label.add_theme_color_override("font_color", Color(0.6, 0.6, 0.7, 0.8))
	close_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(close_label)
	_stranded_popup_layer.visible = true


func _try_activate_win_control(instance_id: String, planet_index: int) -> void:
	if instance_id.is_empty() or planet_index < 0:
		return
	Connection.get_client().send_message({
		"type": "game_action",
		"action": {"kind": "activate_win_control", "instanceId": instance_id, "planetIndex": planet_index}
	})
	if _stranded_popup_layer:
		_stranded_popup_layer.visible = false


# ---------------------------------------------------------------------------
# Evacuation UI
# ---------------------------------------------------------------------------

func _uses_hyperspace(pub: Dictionary) -> bool:
	return str(pub.get("ruleset", "dotf")) != "classic"


func _has_transport_in_hyperspace(pub: Dictionary, my_side: String) -> bool:
	var ships: Array = pub.get("lightHyperspace" if my_side == "light" else "darkHyperspace", [])
	for entry in ships:
		var card_id: String = entry.get("cardId", "")
		if CardCatalog:
			var info: Dictionary = CardCatalog.get_card_info(card_id, "")
			if info.get("type", "") == "starship" and str(info.get("trait", "")).to_lower() == "transport":
				return true
	return false


func _has_transport_in_hand(state: RefCounted) -> bool:
	var hand: Array = state.hand_with_instances
	for entry in hand:
		var card_id: String = entry.get("cardId", "")
		if CardCatalog:
			var info: Dictionary = CardCatalog.get_card_info(card_id, "")
			if info.get("type", "") == "starship" and str(info.get("trait", "")).to_lower() == "transport":
				return true
	return false


func _get_transport_cards_in_hand(state: RefCounted) -> Array:
	var result: Array = []
	var hand: Array = state.hand_with_instances
	for entry in hand:
		var card_id: String = entry.get("cardId", "")
		if CardCatalog:
			var info: Dictionary = CardCatalog.get_card_info(card_id, "")
			if info.get("type", "") == "starship" and str(info.get("trait", "")).to_lower() == "transport":
				result.append(entry)
	return result


func _get_starfighter_cards_in_hand(state: RefCounted) -> Array:
	var result: Array = []
	var hand: Array = state.hand_with_instances
	for entry in hand:
		var card_id: String = entry.get("cardId", "")
		if CardCatalog:
			var info: Dictionary = CardCatalog.get_card_info(card_id, "")
			if info.get("type", "") == "starship" and str(info.get("trait", "")).to_lower() == "starfighter":
				result.append(entry)
	return result


## Only controlled planets (won by someone) where we have stranded characters/weapons.
func _get_evacuatable_planet_info(pub: Dictionary, my_side: String) -> Array:
	var result: Array = []
	var planets: Array = pub.get("controlledPlanets", [])
	var stranded_key: String = "strandedLight" if my_side == "light" else "strandedDark"
	for i in range(planets.size()):
		var pd: Dictionary = planets[i]
		var stranded: Array = pd.get(stranded_key, [])
		var stranded_cards: Array = []
		for c in stranded:
			var card_id: String = c.get("cardId", "")
			if CardCatalog:
				var info: Dictionary = CardCatalog.get_card_info(card_id, "")
				var t: String = str(info.get("type", "")).to_lower()
				if t == "character" or t == "weapon":
					stranded_cards.append(c)
		if stranded_cards.size() > 0:
			result.append({
				"index": i,
				"planet": pd.get("planet", "Planet %d" % i),
				"locationCardId": pd.get("locationCardId", ""),
				"controlledBy": pd.get("controlledBy", ""),
				"count": stranded_cards.size(),
				"strandedCards": stranded_cards
			})
	return result


func _update_evacuation_ui(state: RefCounted, pub: Dictionary, phase: String, my_side: String) -> void:
	var evac_state: Dictionary = pub.get("evacuationState", {})
	var evac_result: Dictionary = pub.get("evacuationResult", {})
	var turn_side: String = state.game_state.get("turnSide", "")
	var is_my_turn: bool = (turn_side == my_side)
	# Show evacuate button during deploy when conditions met
	if evacuate_btn:
		if phase == "deploy" and is_my_turn and evac_state.size() == 0 and evac_result.size() == 0:
			var has_transport: bool = _uses_hyperspace(pub) and _has_transport_in_hyperspace(pub, my_side)
			if not _uses_hyperspace(pub):
				has_transport = _has_transport_in_hand(state)
			var evacuatable: Array = _get_evacuatable_planet_info(pub, my_side)
			evacuate_btn.visible = has_transport and evacuatable.size() > 0
		else:
			evacuate_btn.visible = false
	# Show interception prompt to opponent
	if evac_state.size() > 0 and evac_state.get("awaitingInterception", false):
		var evac_side: String = evac_state.get("evacuatingSide", "")
		if evac_side == my_side:
			status_label.text = "Evacuating... waiting for opponent to respond."
			if _uses_hyperspace(pub) and _dotf_overlay_kind == "intercept":
				_clear_dotf_overlay()
		else:
			if _uses_hyperspace(pub):
				_show_dotf_intercept_bar(state, evac_state)
			else:
				_show_interception_prompt(state, evac_state)
	elif evac_result.size() > 0:
		if _dotf_overlay_kind == "intercept":
			_clear_dotf_overlay()
		if _battle_reveal_sequence.size() > 0:
			pass
		elif _evacuation_overlay and is_instance_valid(_evacuation_overlay):
			pass
		elif _uses_hyperspace(pub):
			if evac_result.get("outcome", "") == "success":
				_show_transport_complete_then_dismiss(evac_result, my_side)
			else:
				_show_hyperspace_evac_failed(evac_result, my_side)
		elif not evac_result.get("intercepted", false) and evac_result.get("outcome", "") == "success":
			_show_transport_complete_then_dismiss(evac_result, my_side)
		else:
			_show_evacuation_result(evac_result, my_side)
	elif _dotf_overlay_kind == "intercept":
		_clear_dotf_overlay()


func _on_evacuate_pressed() -> void:
	var state: RefCounted = Connection.get_state()
	var pub: Dictionary = state.game_state.get("publicState", {})
	var my_side: String = state.game_side
	var planets: Array = _get_evacuatable_planet_info(pub, my_side)
	if planets.is_empty():
		status_label.text = "No cards to evacuate."
		return
	if _uses_hyperspace(pub):
		if not _has_transport_in_hyperspace(pub, my_side):
			status_label.text = "Need a transport in Hyperspace."
			return
		_show_evacuation_picker([], planets, my_side)
		return
	var transports: Array = _get_transport_cards_in_hand(state)
	if transports.is_empty():
		status_label.text = "No transport or no cards to evacuate."
		return
	_show_evacuation_picker(transports, planets, my_side)


func _show_evacuation_picker(transports: Array, planets: Array, my_side: String) -> void:
	if _evacuation_overlay:
		_evacuation_overlay.queue_free()
		_evacuation_overlay = null
	_evacuation_overlay = CanvasLayer.new()
	_evacuation_overlay.layer = 200
	add_child(_evacuation_overlay)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.05, 0.05, 0.15, 0.85)
	_evacuation_overlay.add_child(bg)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_evacuation_overlay.add_child(scroll)
	var center := CenterContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	center.custom_minimum_size = Vector2(600, 0)
	scroll.add_child(center)
	_evacuation_panel = PanelContainer.new()
	_evacuation_panel.custom_minimum_size = Vector2(560, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.12, 0.14, 0.22, 0.98)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.4, 0.6, 0.9, 0.8)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	_evacuation_panel.add_theme_stylebox_override("panel", style)
	center.add_child(_evacuation_panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	_evacuation_panel.add_child(vbox)
	var title := Label.new()
	title.text = "Evacuation — Select Planet" if transports.is_empty() else "Evacuation — Select Transport & Planet"
	title.add_theme_font_size_override("font_size", 16)
	title.add_theme_color_override("font_color", Color(0.9, 0.85, 0.4, 1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)
	if transports.is_empty():
		var hs_note := Label.new()
		hs_note.text = "Your entire Hyperspace pile will attempt this evacuation. All characters and weapons at the planet go."
		hs_note.add_theme_font_size_override("font_size", 12)
		hs_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		vbox.add_child(hs_note)
	var selected_transport: Dictionary = {} if transports.is_empty() else transports[0]
	if not transports.is_empty():
		var transport_label := Label.new()
		transport_label.text = "Select Transport Ship:"
		transport_label.add_theme_font_size_override("font_size", 13)
		vbox.add_child(transport_label)
		var transport_row := HBoxContainer.new()
		transport_row.alignment = BoxContainer.ALIGNMENT_CENTER
		transport_row.add_theme_constant_override("separation", 10)
		vbox.add_child(transport_row)
		var _transport_highlight_border: Panel = null
		for t in transports:
			var card_id: String = t.get("cardId", "")
			var wrapper := Panel.new()
			wrapper.custom_minimum_size = Vector2(78, 112)
			var wrapper_style := StyleBoxFlat.new()
			wrapper_style.bg_color = Color(0, 0, 0, 0)
			wrapper_style.border_width_left = 3
			wrapper_style.border_width_right = 3
			wrapper_style.border_width_top = 3
			wrapper_style.border_width_bottom = 3
			wrapper_style.corner_radius_top_left = 4
			wrapper_style.corner_radius_top_right = 4
			wrapper_style.corner_radius_bottom_left = 4
			wrapper_style.corner_radius_bottom_right = 4
			if t == transports[0]:
				wrapper_style.border_color = Color(0.4, 0.9, 0.4)
				_transport_highlight_border = wrapper
			else:
				wrapper_style.border_color = Color(0.3, 0.3, 0.3, 0.5)
			wrapper.add_theme_stylebox_override("panel", wrapper_style)
			var tex := TextureRect.new()
			tex.custom_minimum_size = Vector2(72, 106)
			tex.set_anchors_preset(Control.PRESET_FULL_RECT)
			tex.offset_left = 3
			tex.offset_top = 3
			tex.offset_right = -3
			tex.offset_bottom = -3
			tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			tex.texture = _load_card_texture_for_id(card_id, my_side)
			wrapper.add_child(tex)
			var click_btn := Button.new()
			click_btn.set_anchors_preset(Control.PRESET_FULL_RECT)
			click_btn.flat = true
			click_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
			var t_copy: Dictionary = t.duplicate()
			var w_ref := wrapper
			click_btn.pressed.connect(func() -> void:
				selected_transport = t_copy
				for ch in transport_row.get_children():
					var s: StyleBoxFlat = ch.get_theme_stylebox("panel") as StyleBoxFlat
					if s:
						s.border_color = Color(0.3, 0.3, 0.3, 0.5)
				var ws: StyleBoxFlat = w_ref.get_theme_stylebox("panel") as StyleBoxFlat
				if ws:
					ws.border_color = Color(0.4, 0.9, 0.4)
				w_ref.queue_redraw()
			)
			wrapper.add_child(click_btn)
			transport_row.add_child(wrapper)
	# Planet selection — card images with stranded cards below
	var planet_label := Label.new()
	planet_label.text = "Select Planet to Evacuate:"
	planet_label.add_theme_font_size_override("font_size", 13)
	vbox.add_child(planet_label)
	var planet_row := HBoxContainer.new()
	planet_row.alignment = BoxContainer.ALIGNMENT_CENTER
	planet_row.add_theme_constant_override("separation", 10)
	vbox.add_child(planet_row)
	var stranded_container := VBoxContainer.new()
	stranded_container.add_theme_constant_override("separation", 4)
	vbox.add_child(stranded_container)
	var selected_planet: Dictionary = planets[0]
	var _update_stranded_display := func(planet_data: Dictionary) -> void:
		for ch in stranded_container.get_children():
			ch.queue_free()
		var cards: Array = planet_data.get("strandedCards", [])
		if cards.is_empty():
			return
		var stranded_label := Label.new()
		stranded_label.text = "Stranded cards at %s:" % planet_data.get("planet", "?")
		stranded_label.add_theme_font_size_override("font_size", 12)
		stranded_label.add_theme_color_override("font_color", Color(0.7, 0.8, 1.0))
		stranded_container.add_child(stranded_label)
		var cards_row := HBoxContainer.new()
		cards_row.alignment = BoxContainer.ALIGNMENT_CENTER
		cards_row.add_theme_constant_override("separation", 4)
		stranded_container.add_child(cards_row)
		for c in cards:
			var cid: String = c.get("cardId", "")
			var face_down: bool = c.get("faceDown", false)
			var card_tex := TextureRect.new()
			card_tex.custom_minimum_size = Vector2(50, 72)
			card_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			card_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			card_tex.texture = (CARD_BACK_LIGHT if my_side == "light" else CARD_BACK_DARK) if face_down else _load_card_texture_for_id(cid, my_side)
			cards_row.add_child(card_tex)
	_update_stranded_display.call(planets[0])
	for p in planets:
		var loc_card_id: String = p.get("locationCardId", "")
		var loc_side: String = p.get("controlledBy", "")
		if loc_side.is_empty():
			loc_side = my_side
		var wrapper := Panel.new()
		wrapper.custom_minimum_size = Vector2(140, 100)
		var wrapper_style := StyleBoxFlat.new()
		wrapper_style.bg_color = Color(0, 0, 0, 0)
		wrapper_style.border_width_left = 3
		wrapper_style.border_width_right = 3
		wrapper_style.border_width_top = 3
		wrapper_style.border_width_bottom = 3
		wrapper_style.corner_radius_top_left = 4
		wrapper_style.corner_radius_top_right = 4
		wrapper_style.corner_radius_bottom_left = 4
		wrapper_style.corner_radius_bottom_right = 4
		if p == planets[0]:
			wrapper_style.border_color = Color(0.4, 0.9, 0.4)
		else:
			wrapper_style.border_color = Color(0.3, 0.3, 0.3, 0.5)
		wrapper.add_theme_stylebox_override("panel", wrapper_style)
		var tex := TextureRect.new()
		tex.custom_minimum_size = Vector2(134, 94)
		tex.set_anchors_preset(Control.PRESET_FULL_RECT)
		tex.offset_left = 3
		tex.offset_top = 3
		tex.offset_right = -3
		tex.offset_bottom = -3
		tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
		tex.texture = _load_card_texture_for_id(loc_card_id, loc_side)
		wrapper.add_child(tex)
		var name_lbl := Label.new()
		name_lbl.text = "%s (%d)" % [p.get("planet", "?"), p.get("count", 0)]
		name_lbl.add_theme_font_size_override("font_size", 10)
		name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name_lbl.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		name_lbl.offset_top = -18
		name_lbl.add_theme_color_override("font_color", Color(1, 1, 1, 0.9))
		wrapper.add_child(name_lbl)
		var click_btn := Button.new()
		click_btn.set_anchors_preset(Control.PRESET_FULL_RECT)
		click_btn.flat = true
		click_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		var p_copy: Dictionary = p.duplicate(true)
		var w_ref := wrapper
		click_btn.pressed.connect(func() -> void:
			selected_planet = p_copy
			for ch in planet_row.get_children():
				var s: StyleBoxFlat = ch.get_theme_stylebox("panel") as StyleBoxFlat
				if s:
					s.border_color = Color(0.3, 0.3, 0.3, 0.5)
			var ws: StyleBoxFlat = w_ref.get_theme_stylebox("panel") as StyleBoxFlat
			if ws:
				ws.border_color = Color(0.4, 0.9, 0.4)
			w_ref.queue_redraw()
			_update_stranded_display.call(p_copy)
		)
		wrapper.add_child(click_btn)
		planet_row.add_child(wrapper)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 6)
	vbox.add_child(spacer)
	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 16)
	vbox.add_child(btn_row)
	var confirm_btn := Button.new()
	confirm_btn.text = "Launch Evacuation"
	_style_action_button(confirm_btn, "primary")
	confirm_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": {
				"kind": "evacuate_start",
				"transportInstanceId": selected_transport.get("instanceId", ""),
				"targetPlanetIndex": int(selected_planet.get("index", 0))
			}
		})
		if _evacuation_overlay:
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
	)
	btn_row.add_child(confirm_btn)
	var cancel_btn := Button.new()
	cancel_btn.text = "Cancel"
	_style_action_button(cancel_btn, "secondary")
	cancel_btn.pressed.connect(func() -> void:
		if _evacuation_overlay:
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
	)
	btn_row.add_child(cancel_btn)


func _show_interception_prompt(state: RefCounted, evac_state: Dictionary) -> void:
	if _evacuation_overlay:
		_evacuation_overlay.queue_free()
		_evacuation_overlay = null
	_evacuation_overlay = CanvasLayer.new()
	_evacuation_overlay.layer = 200
	add_child(_evacuation_overlay)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.05, 0.05, 0.15, 0.85)
	_evacuation_overlay.add_child(bg)
	_evacuation_panel = PanelContainer.new()
	_evacuation_panel.set_anchors_preset(Control.PRESET_CENTER)
	_evacuation_panel.offset_left = -300
	_evacuation_panel.offset_top = -240
	_evacuation_panel.offset_right = 300
	_evacuation_panel.offset_bottom = 240
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.18, 0.1, 0.1, 0.98)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.9, 0.4, 0.3, 0.8)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	_evacuation_panel.add_theme_stylebox_override("panel", style)
	_evacuation_overlay.add_child(_evacuation_panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	_evacuation_panel.add_child(vbox)
	var transport_card_id: String = evac_state.get("transportCardId", "")
	var evac_side: String = evac_state.get("evacuatingSide", "")
	var transport_name: String = transport_card_id
	if CardCatalog:
		transport_name = CardCatalog.get_card_info(transport_card_id, "").get("name", transport_name)
	var card_count: int = (evac_state.get("stackedCardIds", []) as Array).size()
	var title := Label.new()
	title.text = "Opponent is evacuating!"
	title.add_theme_font_size_override("font_size", 16)
	title.add_theme_color_override("font_color", Color(1.0, 0.6, 0.3, 1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)
	var desc := Label.new()
	desc.text = "%s is picking up %d cards. Intercept?" % [transport_name, card_count]
	desc.add_theme_font_size_override("font_size", 13)
	desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(desc)
	var transport_row := HBoxContainer.new()
	transport_row.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_child(transport_row)
	var transport_tex := TextureRect.new()
	transport_tex.custom_minimum_size = Vector2(72, 104)
	transport_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	transport_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	transport_tex.texture = _load_card_texture_for_id(transport_card_id, evac_side)
	transport_row.add_child(transport_tex)
	var stacked_ids: Array = evac_state.get("stackedCardIds", [])
	for cid in stacked_ids:
		var stacked_tex := TextureRect.new()
		stacked_tex.custom_minimum_size = Vector2(44, 64)
		stacked_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		stacked_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		stacked_tex.texture = _load_card_texture_for_id(str(cid), evac_side)
		transport_row.add_child(stacked_tex)
	var starfighters: Array = _get_starfighter_cards_in_hand(state)
	if starfighters.size() > 0:
		var sf_label := Label.new()
		sf_label.text = "Your Starfighters (click to intercept):"
		sf_label.add_theme_font_size_override("font_size", 12)
		sf_label.add_theme_color_override("font_color", Color(0.9, 0.7, 0.7))
		vbox.add_child(sf_label)
		var sf_row := HBoxContainer.new()
		sf_row.alignment = BoxContainer.ALIGNMENT_CENTER
		sf_row.add_theme_constant_override("separation", 8)
		vbox.add_child(sf_row)
		for sf in starfighters:
			var sf_card_id: String = sf.get("cardId", "")
			var sf_side: String = state.game_side
			var wrapper := Panel.new()
			wrapper.custom_minimum_size = Vector2(78, 112)
			var ws := StyleBoxFlat.new()
			ws.bg_color = Color(0, 0, 0, 0)
			ws.border_width_left = 2
			ws.border_width_right = 2
			ws.border_width_top = 2
			ws.border_width_bottom = 2
			ws.border_color = Color(0.9, 0.4, 0.3, 0.8)
			ws.corner_radius_top_left = 4
			ws.corner_radius_top_right = 4
			ws.corner_radius_bottom_left = 4
			ws.corner_radius_bottom_right = 4
			wrapper.add_theme_stylebox_override("panel", ws)
			var tex := TextureRect.new()
			tex.set_anchors_preset(Control.PRESET_FULL_RECT)
			tex.offset_left = 2
			tex.offset_top = 2
			tex.offset_right = -2
			tex.offset_bottom = -2
			tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			tex.texture = _load_card_texture_for_id(sf_card_id, sf_side)
			wrapper.add_child(tex)
			var click_btn := Button.new()
			click_btn.set_anchors_preset(Control.PRESET_FULL_RECT)
			click_btn.flat = true
			click_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
			var sf_copy: Dictionary = sf.duplicate()
			click_btn.pressed.connect(func() -> void:
				Connection.get_client().send_message({
					"type": "game_action",
					"action": {
						"kind": "intercept_transport",
						"starfighterInstanceId": sf_copy.get("instanceId", "")
					}
				})
				if _evacuation_overlay:
					_evacuation_overlay.queue_free()
					_evacuation_overlay = null
			)
			wrapper.add_child(click_btn)
			sf_row.add_child(wrapper)
	else:
		var no_sf := Label.new()
		no_sf.text = "You have no Starfighters to intercept."
		no_sf.add_theme_font_size_override("font_size", 12)
		no_sf.add_theme_color_override("font_color", Color(0.7, 0.5, 0.5))
		no_sf.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vbox.add_child(no_sf)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 6)
	vbox.add_child(spacer)
	var decline_btn := Button.new()
	decline_btn.text = "Let them evacuate"
	_style_action_button(decline_btn, "secondary")
	decline_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": {"kind": "decline_intercept"}
		})
		if _evacuation_overlay:
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
	)
	vbox.add_child(decline_btn)


func _clear_dotf_overlay() -> void:
	if _dotf_overlay and is_instance_valid(_dotf_overlay):
		_dotf_overlay.queue_free()
	_dotf_overlay = null
	_dotf_overlay_kind = ""
	_win_control_selected.clear()
	_win_control_needed = 0


func _show_dotf_intercept_bar(state: RefCounted, evac_state: Dictionary) -> void:
	if _dotf_overlay_kind == "intercept" and _dotf_overlay and is_instance_valid(_dotf_overlay):
		return
	_clear_dotf_overlay()
	_dotf_overlay_kind = "intercept"
	_dotf_overlay = CanvasLayer.new()
	_dotf_overlay.layer = 80
	add_child(_dotf_overlay)
	var bar := PanelContainer.new()
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 80
	bar.offset_right = -80
	bar.offset_top = 8
	bar.offset_bottom = 88
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.18, 0.1, 0.1, 0.94)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.9, 0.45, 0.3, 0.9)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	bar.add_theme_stylebox_override("panel", style)
	_dotf_overlay.add_child(bar)
	var vbox := VBoxContainer.new()
	bar.add_child(vbox)
	var n: int = (evac_state.get("stackedCardIds", []) as Array).size()
	var lbl := Label.new()
	lbl.text = "Opponent is evacuating %d cards. Deploy starships to Hyperspace, then intercept with your whole pile — or let them go." % n
	lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(lbl)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	vbox.add_child(row)
	var intercept_btn := Button.new()
	intercept_btn.text = "Intercept with Hyperspace"
	_style_action_button(intercept_btn, "primary")
	intercept_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "intercept_transport"}})
		_clear_dotf_overlay()
	)
	row.add_child(intercept_btn)
	var decline_btn := Button.new()
	decline_btn.text = "Let them evacuate"
	_style_action_button(decline_btn, "secondary")
	decline_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "decline_intercept"}})
		_clear_dotf_overlay()
	)
	row.add_child(decline_btn)
	status_label.text = "You may still play starships into Hyperspace, then intercept."


func _begin_choice_overlay(kind: String, title_text: String) -> VBoxContainer:
	_clear_dotf_overlay()
	_dotf_overlay_kind = kind
	_dotf_overlay = CanvasLayer.new()
	_dotf_overlay.layer = 190
	add_child(_dotf_overlay)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.02, 0.03, 0.08, 0.78)
	_dotf_overlay.add_child(bg)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dotf_overlay.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(600, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.12, 0.97)
	style.set_border_width_all(2)
	style.border_color = Color(0.86, 0.72, 0.32, 0.7)
	style.set_corner_radius_all(12)
	style.content_margin_left = 24
	style.content_margin_right = 24
	style.content_margin_top = 18
	style.content_margin_bottom = 20
	style.shadow_color = Color(0, 0, 0, 0.55)
	style.shadow_size = 18
	style.shadow_offset = Vector2(0, 4)
	panel.add_theme_stylebox_override("panel", style)
	center.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)
	var title := Label.new()
	title.text = title_text.to_upper()
	title.theme_type_variation = &"HeaderLabel"
	title.add_theme_font_size_override("font_size", 16)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(title)
	vbox.child_entered_tree.connect(_style_overlay_child)
	return vbox


func _add_card_row(parent: Node, cards: Array, side: String, on_pick: Callable) -> void:
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(560, 156)
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	parent.add_child(scroll)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(row)
	for entry in cards:
		var card_id: String = entry.get("cardId", "")
		var inst: String = entry.get("instanceId", "")
		var card_set: String = str(entry.get("set", ""))
		var card: Control = CardPlaceholderScene.instantiate()
		row.add_child(card)
		card.set_card(card_id, inst, side, card_set)
		if card.has_signal("card_selected"):
			card.card_selected.connect(func(picked: String) -> void:
				on_pick.call(picked, card_id)
			)


func _update_dotf_choice_ui(state: RefCounted, pub: Dictionary, my_side: String) -> void:
	if status_label and (status_label.text.begins_with("Opponent may ") or status_label.text.begins_with("Opponent is ")):
		status_label.text = ""
	var fetch: Variant = pub.get("planetEffectFetch", null)
	if fetch is Dictionary and str(fetch.get("chooserSide", "")) == my_side:
		if _dotf_overlay_kind != "planet_effect":
			var vbox := _begin_choice_overlay("planet_effect", "Take one Effect from your deck? (optional)")
			var choices: Array = fetch.get("effectChoices", [])
			if choices.is_empty():
				var none := Label.new()
				none.text = "No Effects in your deck."
				none.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				vbox.add_child(none)
			else:
				_add_card_row(vbox, choices, my_side, func(inst: String, _cid: String) -> void:
					Connection.get_client().send_message({"type": "game_action", "action": {"kind": "fetch_planet_effect", "instanceId": inst}})
					_clear_dotf_overlay()
				)
			var skip := Button.new()
			skip.text = "Skip"
			skip.pressed.connect(func() -> void:
				Connection.get_client().send_message({"type": "game_action", "action": {"kind": "skip_planet_effect"}})
				_clear_dotf_overlay()
			)
			vbox.add_child(skip)
		return
	if fetch is Dictionary and str(fetch.get("chooserSide", "")) != my_side:
		if _dotf_overlay_kind == "planet_effect":
			_clear_dotf_overlay()
		status_label.text = "Opponent may take an Effect from their deck..."
		return

	var dfd: Variant = pub.get("deployFromDeckPending", null)
	if dfd is Dictionary and str(dfd.get("side", "")) == my_side:
		if _dotf_overlay_kind != "deploy_from_deck":
			var found: bool = bool(dfd.get("found", false))
			var vbox := _begin_choice_overlay("deploy_from_deck", "Deploy from deck")
			var note := Label.new()
			note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			if found:
				var dfd_cost: Variant = dfd.get("cost", "free")
				if str(dfd_cost) == "free" or str(dfd_cost) == "0":
					note.text = "Found a matching card. Deploy it now, or skip (1 DAMAGE)."
				else:
					note.text = "Found a matching card. Deploy it now (pays its cost), or skip (1 DAMAGE)."
				if bool(dfd.get("discardSearcher", false)):
					note.text += " Deploying it also discards this character."
			else:
				note.text = "No matching card in your deck. Continue."
			vbox.add_child(note)
			if found:
				var cid: String = str(dfd.get("foundCardId", ""))
				var preview: Control = CardPlaceholderScene.instantiate()
				vbox.add_child(preview)
				preview.set_card(cid, "preview", my_side, str(dfd.get("foundSet", "")))
				var deploy_btn := Button.new()
				deploy_btn.text = "Deploy"
				deploy_btn.pressed.connect(func() -> void:
					Connection.get_client().send_message({"type": "game_action", "action": {"kind": "confirm_deploy_from_deck"}})
					_clear_dotf_overlay()
				)
				vbox.add_child(deploy_btn)
			var skip := Button.new()
			skip.text = "Skip" if found else "Continue"
			skip.pressed.connect(func() -> void:
				Connection.get_client().send_message({"type": "game_action", "action": {"kind": "decline_deploy_from_deck"}})
				_clear_dotf_overlay()
			)
			vbox.add_child(skip)
		return
	var train: Variant = pub.get("jediTrainingPending", null)
	if train is Dictionary and str(train.get("side", "")) == my_side:
		if _dotf_overlay_kind != "jedi_training":
			_show_jedi_training(train, my_side)
		return
	if train is Dictionary and str(train.get("side", "")) != my_side:
		if _dotf_overlay_kind == "jedi_training":
			_clear_dotf_overlay()
		status_label.text = "Opponent may deploy a lightsaber from their deck..."
		return
	var drawp: Variant = pub.get("deployDrawPending", null)
	if drawp is Dictionary and str(drawp.get("side", "")) == my_side:
		if _dotf_overlay_kind != "deploy_draw":
			var vbox := _begin_choice_overlay("deploy_draw", "Draw a card?")
			var note := Label.new()
			note.text = "He deployed to Coruscant. Draw a card, or skip."
			note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			vbox.add_child(note)
			var yes := Button.new()
			yes.text = "Draw"
			yes.pressed.connect(func() -> void:
				Connection.get_client().send_message({"type": "game_action", "action": {"kind": "confirm_deploy_draw"}})
				_clear_dotf_overlay()
			)
			var no := Button.new()
			no.text = "Skip"
			no.pressed.connect(func() -> void:
				Connection.get_client().send_message({"type": "game_action", "action": {"kind": "decline_deploy_draw"}})
				_clear_dotf_overlay()
			)
			vbox.add_child(yes)
			vbox.add_child(no)
		return
	if drawp is Dictionary and str(drawp.get("side", "")) != my_side:
		if _dotf_overlay_kind == "deploy_draw":
			_clear_dotf_overlay()
		status_label.text = "Opponent may draw a card..."
		return
	var pounded: Variant = pub.get("poundedPending", null)
	if pounded is Dictionary and str(pounded.get("side", "")) == my_side:
		if _dotf_overlay_kind != "pounded":
			_show_pounded(pounded, my_side)
		return
	if pounded is Dictionary and str(pounded.get("side", "")) != my_side:
		if _dotf_overlay_kind == "pounded":
			_clear_dotf_overlay()
		status_label.text = "Opponent is choosing a non-unique card to discard..."
		return
	var bottom: Variant = pub.get("effectActivationPending", null)
	if bottom is Dictionary and str(bottom.get("kind", "")) == "bottom_hand" and str(bottom.get("side", "")) == my_side:
		if _dotf_overlay_kind != "bottom_hand":
			_show_bottom_hand(my_side)
		return
	if bottom is Dictionary and str(bottom.get("kind", "")) == "bottom_hand" and str(bottom.get("side", "")) != my_side:
		if _dotf_overlay_kind == "bottom_hand":
			_clear_dotf_overlay()
		status_label.text = "Opponent is putting a card under their deck..."
		return
	var wcp: Variant = pub.get("winControlPending", null)
	if wcp is Dictionary and str(wcp.get("side", "")) == my_side:
		if _dotf_overlay_kind != "win_control":
			_begin_win_control_overlay(state, wcp, my_side)
		return
	if wcp is Dictionary and str(wcp.get("side", "")) != my_side:
		if _dotf_overlay_kind == "win_control":
			_clear_dotf_overlay()
		status_label.text = "Opponent is using a won-planet ability..."
		return
	var peek: Variant = pub.get("effectActivationPending", null)
	if peek is Dictionary and str(peek.get("kind", "")) == "peek_opp_deck" and str(peek.get("side", "")) == my_side:
		if _dotf_overlay_kind != "peek_opp_deck":
			_show_opp_deck_peek(peek, my_side)
		return
	if peek is Dictionary and str(peek.get("kind", "")) == "peek_opp_deck" and str(peek.get("side", "")) != my_side:
		if _dotf_overlay_kind == "peek_opp_deck":
			_clear_dotf_overlay()
		status_label.text = "Opponent is looking at the top card of your deck..."
		return
	var swap: Variant = pub.get("destinySwapPending", null)
	if swap is Dictionary and str(swap.get("side", "")) == my_side:
		if _dotf_overlay_kind != "destiny_swap":
			_show_destiny_swap(swap)
		return
	if swap is Dictionary and str(swap.get("side", "")) != my_side:
		if _dotf_overlay_kind == "destiny_swap":
			_clear_dotf_overlay()
		status_label.text = "Opponent is switching destiny numbers..."
		return
	var replace_damage: Variant = pub.get("damageReplacePending", null)
	if replace_damage is Dictionary and str(replace_damage.get("side", "")) == my_side:
		var drawn: Dictionary = replace_damage.get("draw", {})
		var drawn_key := str(drawn.get("key", ""))
		if _dotf_overlay_kind != "damage_replace" or _damage_replace_key != drawn_key:
			_damage_replace_key = drawn_key
			_show_damage_replace(replace_damage)
		return
	if replace_damage is Dictionary and str(replace_damage.get("side", "")) != my_side:
		if _dotf_overlay_kind == "damage_replace":
			_clear_dotf_overlay()
		status_label.text = "Opponent may replace a destiny number with damage..."
		return

	if _dotf_overlay_kind == "planet_effect" or _dotf_overlay_kind == "deploy_from_deck" or _dotf_overlay_kind == "win_control" or _dotf_overlay_kind == "destiny_swap" or _dotf_overlay_kind == "damage_replace" or _dotf_overlay_kind == "peek_opp_deck" or _dotf_overlay_kind == "jedi_training" or _dotf_overlay_kind == "bottom_hand" or _dotf_overlay_kind == "pounded" or _dotf_overlay_kind == "deploy_draw":
		if not (fetch is Dictionary) and not (dfd is Dictionary) and not (wcp is Dictionary) and not (swap is Dictionary) and not (replace_damage is Dictionary) and not (peek is Dictionary and str(peek.get("kind", "")) == "peek_opp_deck") and not (train is Dictionary) and not (bottom is Dictionary and str(bottom.get("kind", "")) == "bottom_hand") and not (pounded is Dictionary) and not (drawp is Dictionary):
			_clear_dotf_overlay()

	_update_duel_ui(state, pub, my_side)


func _show_pounded(pending: Dictionary, my_side: String) -> void:
	var vbox := _begin_choice_overlay("pounded", "Pounded Unto Death — discard one non-unique card")
	var note := Label.new()
	note.text = "This Effect is discarded. The card you pick is discarded. It does not lose damage."
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(note)
	var opp_side := "dark" if my_side == "light" else "light"
	_add_card_row(vbox, pending.get("targets", []), opp_side, func(inst: String, _cid: String) -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "confirm_pounded", "instanceId": inst}})
	)
	var cancel := Button.new()
	cancel.text = "Cancel"
	cancel.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "decline_pounded"}})
	)
	vbox.add_child(cancel)


func _side_force(my_side: String) -> int:
	var conn_state: RefCounted = Connection.get_state()
	if not conn_state:
		return 0
	var gs: Dictionary = conn_state.game_state
	var view: Dictionary = gs.get("light" if my_side == "light" else "dark", {})
	return int(view.get("force", 0))


func _show_jedi_training(pending: Dictionary, my_side: String) -> void:
	var force := _side_force(my_side)
	var vbox := _begin_choice_overlay("jedi_training", "Deploy a lightsaber from your deck")
	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.text = "Discard this Effect and pay the cost on the card. You have %d counters." % force
	vbox.add_child(note)
	var choices: Array = pending.get("choices", [])
	var affordable := 0
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(520, 268)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vbox.add_child(scroll)
	var grid := GridContainer.new()
	grid.columns = 5
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	scroll.add_child(grid)
	for entry in choices:
		if not (entry is Dictionary):
			continue
		var cid := str(entry.get("cardId", ""))
		var inst := str(entry.get("instanceId", ""))
		var cost := int(entry.get("cost", 0))
		var can_pay := cost <= force
		var card: Control = CardPlaceholderScene.instantiate()
		grid.add_child(card)
		card.set_card(cid, inst, my_side, str(entry.get("set", "")))
		if card.has_method("set_board_size"):
			card.set_board_size(Vector2(92, 128))
		if can_pay:
			affordable += 1
			if card.has_method("set_action_glow"):
				card.set_action_glow("play")
			if card.has_signal("card_selected"):
				card.card_selected.connect((func(chosen: String) -> void:
					Connection.get_client().send_message({"type": "game_action", "action": {"kind": "confirm_jedi_training", "instanceId": chosen}})
				))
		else:
			card.modulate = Color(1, 1, 1, 0.38)
		_jedi_cost_badge(card, cost, can_pay)
	if affordable == 0 and not choices.is_empty():
		note.text = "You have %d counters, so none of these lightsabers can be deployed. Skip for now." % force
	var skip := Button.new()
	skip.text = "Skip"
	skip.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "decline_jedi_training"}})
	)
	vbox.add_child(skip)


func _jedi_cost_badge(card: Control, cost: int, can_pay: bool) -> void:
	var badge := Label.new()
	badge.text = str(cost) if can_pay else ("Need %d" % cost)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	badge.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	badge.offset_left = 6
	badge.offset_right = -6
	badge.offset_top = -26
	badge.offset_bottom = -6
	badge.add_theme_font_size_override("font_size", 13)
	badge.add_theme_color_override("font_color", Color(1, 0.93, 0.62) if can_pay else Color(1, 0.72, 0.68))
	badge.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.95))
	badge.add_theme_constant_override("shadow_offset_x", 0)
	badge.add_theme_constant_override("shadow_offset_y", 1)
	badge.add_theme_constant_override("shadow_outline_size", 4)
	card.add_child(badge)


func _show_damage_replace(pending: Dictionary) -> void:
	var damage := int(pending.get("damage", 0))
	var drawn: Dictionary = pending.get("draw", {})
	var destiny := int(drawn.get("destiny", 0))
	var vbox := _begin_choice_overlay("damage_replace", "Destiny %d drawn" % destiny)
	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.text = "This destiny was just drawn. You may replace it with your character's damage (%d). If you keep it and another destiny is still coming, that one is drawn next and you can choose again. You can replace only one." % damage
	vbox.add_child(note)
	var cid := str(drawn.get("cardId", ""))
	if not cid.is_empty():
		var preview: Control = CardPlaceholderScene.instantiate()
		vbox.add_child(preview)
		preview.set_card(cid, "destiny", "", str(drawn.get("set", "")))
	var use_btn := Button.new()
	use_btn.text = "Use damage %d instead" % damage
	use_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "confirm_damage_replace", "key": str(drawn.get("key", ""))}})
	)
	var keep_btn := Button.new()
	keep_btn.text = "Keep destiny %d" % destiny
	keep_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "decline_damage_replace"}})
	)
	vbox.add_child(use_btn)
	vbox.add_child(keep_btn)


func _show_bottom_hand(my_side: String) -> void:
	var vbox := _begin_choice_overlay("bottom_hand", "Jedi Meditation — put one hand card under your deck")
	var hand: Array = Connection.get_state().hand_with_instances
	_add_card_row(vbox, hand, my_side, func(inst: String, _cid: String) -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "bottom_hand_card", "instanceId": inst}})
	)
	var cancel := Button.new()
	cancel.text = "Cancel"
	cancel.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "effect_decline"}})
	)
	vbox.add_child(cancel)


func _show_opp_deck_peek(pending: Dictionary, my_side: String) -> void:
	var vbox := _begin_choice_overlay("peek_opp_deck", "Top card of your opponent's deck")
	var cid := str(pending.get("peekedCardId", ""))
	var opp_side := "dark" if my_side == "light" else "light"
	_add_card_row(vbox, [{"instanceId": str(pending.get("peekedInstanceId", "")), "cardId": cid}], opp_side, func(_inst: String, _card: String) -> void:
		pass
	)
	var top_btn := Button.new()
	top_btn.text = "Leave it on top"
	top_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "peek_deck_choice", "place": "top"}})
	)
	var bottom_btn := Button.new()
	bottom_btn.text = "Put it on the bottom"
	bottom_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "peek_deck_choice", "place": "bottom"}})
	)
	vbox.add_child(top_btn)
	vbox.add_child(bottom_btn)


func _card_bonus_text(card_id: String) -> String:
	if not CardCatalog:
		return ""
	var info: Dictionary = CardCatalog.get_card_info(card_id, "")
	return (str(info.get("gametextbonus", "")) + ";" + str(info.get("grayboxbonus", ""))).to_lower()


func _show_destiny_swap(pending: Dictionary) -> void:
	var vbox := _begin_choice_overlay("destiny_swap", "Twist of Fate — switch one of your destiny numbers with a higher one of theirs")
	var picked_yours := ""
	var picked_opps := ""
	var yours_value := -1
	var opps_value := -1
	var status := Label.new()
	status.text = "Pick one of yours, then one of theirs that is higher."
	vbox.add_child(status)
	var yours_row := HBoxContainer.new()
	var opps_row := HBoxContainer.new()
	vbox.add_child(yours_row)
	vbox.add_child(opps_row)
	var confirm := Button.new()
	confirm.text = "Switch those numbers"
	confirm.disabled = true
	var refresh := func() -> void:
		confirm.disabled = picked_yours.is_empty() or picked_opps.is_empty() or yours_value >= opps_value
		if confirm.disabled and not picked_yours.is_empty() and not picked_opps.is_empty():
			status.text = "Your number has to be lower than theirs."
		elif not picked_yours.is_empty() and not picked_opps.is_empty():
			status.text = "Ready to switch %d with %d." % [yours_value, opps_value]
	confirm.pressed.connect(func() -> void:
		if picked_yours.is_empty() or picked_opps.is_empty() or yours_value >= opps_value:
			return
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "confirm_destiny_swap", "yourKey": picked_yours, "oppKey": picked_opps}})
	)
	for entry in pending.get("yours", []):
		if not (entry is Dictionary):
			continue
		var btn := Button.new()
		var value := int(entry.get("destiny", 0))
		btn.text = "Yours %d" % value
		var key := str(entry.get("key", ""))
		btn.pressed.connect((func(k: String, v: int) -> void:
			picked_yours = k
			yours_value = v
			status.text = "Yours %d selected. Now pick a higher opposing number." % v
			refresh.call()
		).bind(key, value))
		yours_row.add_child(btn)
	for entry in pending.get("opps", []):
		if not (entry is Dictionary):
			continue
		var btn := Button.new()
		var value := int(entry.get("destiny", 0))
		btn.text = "Theirs %d" % value
		var key := str(entry.get("key", ""))
		btn.pressed.connect((func(k: String, v: int) -> void:
			picked_opps = k
			opps_value = v
			refresh.call()
		).bind(key, value))
		opps_row.add_child(btn)
	vbox.add_child(confirm)


func _play_duel_card(instance_id: String, card_id: String, discard_for_extra_hits: bool) -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": {"kind": "duel_play_card", "instanceId": instance_id, "discardForExtraHits": discard_for_extra_hits}
	})


func _begin_win_control_overlay(state: RefCounted, pending: Dictionary, my_side: String) -> void:
	if _stranded_popup_layer:
		_stranded_popup_layer.visible = false
	var needed: int = int(pending.get("discardHand", 3))
	var draw_n: int = int(pending.get("draw", 3))
	var cname: String = str(pending.get("characterName", "this character"))
	var vbox := _begin_choice_overlay("win_control", "Discard %d, then draw %d" % [needed, draw_n])
	_win_control_selected.clear()
	_win_control_needed = needed
	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.text = "Using %s. Select exactly %d cards from your hand to discard." % [cname, _win_control_needed]
	vbox.add_child(note)
	var count_label := Label.new()
	count_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	count_label.text = "Selected 0 / %d" % _win_control_needed
	vbox.add_child(count_label)
	var confirm := Button.new()
	confirm.text = "Confirm"
	confirm.disabled = true
	var hand: Array = state.hand_with_instances
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(640, 168)
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vbox.add_child(scroll)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	scroll.add_child(row)
	for entry in hand:
		var card_id: String = entry.get("cardId", "")
		var inst: String = entry.get("instanceId", "")
		var card: Button = CardPlaceholderScene.instantiate()
		row.add_child(card)
		card.set_card(card_id, inst, my_side, str(entry.get("set", "")))
		card.card_selected.connect(_toggle_win_control_card.bind(card, confirm, count_label))
	confirm.pressed.connect(func() -> void:
		if _win_control_selected.size() != _win_control_needed:
			return
		Connection.get_client().send_message({
			"type": "game_action",
			"action": {"kind": "confirm_win_control", "instanceIds": _win_control_selected.duplicate()}
		})
		_clear_dotf_overlay()
	)
	vbox.add_child(confirm)
	var cancel := Button.new()
	cancel.text = "Cancel"
	cancel.pressed.connect(func() -> void:
		Connection.get_client().send_message({"type": "game_action", "action": {"kind": "cancel_win_control"}})
		_clear_dotf_overlay()
	)
	vbox.add_child(cancel)


func _toggle_win_control_card(instance_id: String, btn: Button, confirm: Button, count_label: Label) -> void:
	var idx: int = _win_control_selected.find(instance_id)
	if idx >= 0:
		_win_control_selected.remove_at(idx)
		btn.modulate = Color.WHITE
	elif _win_control_selected.size() < _win_control_needed:
		_win_control_selected.append(instance_id)
		btn.modulate = Color(1.2, 1.12, 0.55)
	count_label.text = "Selected %d / %d" % [_win_control_selected.size(), _win_control_needed]
	confirm.disabled = _win_control_selected.size() != _win_control_needed


func _card_id_at(cards: Array, instance_id: String) -> String:
	for c in cards:
		if str(c.get("instanceId", "")) == instance_id:
			return str(c.get("cardId", ""))
	return ""


func _printed_damage(pub: Dictionary, instance_id: String) -> int:
	if instance_id.is_empty() or not CardCatalog:
		return 0
	for key in ["lightInPlay", "darkInPlay"]:
		for c in pub.get(key, []):
			if str(c.get("instanceId", "")) != instance_id:
				continue
			return int(CardCatalog.get_card_info(str(c.get("cardId", "")), "", str(c.get("set", ""))).get("damage", 0))
	return 0


func _weapon_fits_character(weapon_id: String, weapon_set: String, character_id: String) -> bool:
	if character_id.is_empty() or not CardCatalog:
		return false
	var weapon: Dictionary = CardCatalog.get_card_info(weapon_id, "", weapon_set)
	var character: Dictionary = CardCatalog.get_card_info(character_id, "")
	var can_use := str(weapon.get("canUse", "")).to_lower()
	var can_use2 := str(weapon.get("canUse2", "")).to_lower()
	if can_use == "any" or can_use2 == "any":
		return true
	var blob := ",".join([
		character_id.to_lower(),
		str(character.get("name", "")).to_lower(),
		str(character.get("persona", "")).to_lower(),
		str(character.get("trait", "")).to_lower()
	])
	for raw in (can_use + "," + can_use2).split(","):
		var part := raw.strip_edges().trim_prefix("◆")
		if part.is_empty() or part == "any":
			continue
		if blob.contains(part):
			return true
	return false


func _is_lightsaber_card(card_id: String) -> bool:
	var info: Dictionary = CardCatalog.get_card_info(card_id, "") if CardCatalog else {}
	var idl: String = card_id.to_lower()
	var name_s: String = str(info.get("name", "")).to_lower()
	return idl.contains("lightsaber") or name_s.contains("lightsaber")


func _is_duelist_card(card_id: String, side: String) -> bool:
	var info: Dictionary = CardCatalog.get_card_info(card_id, "") if CardCatalog else {}
	if str(info.get("type", "")).to_lower() != "character":
		return false
	var idl: String = card_id.to_lower()
	if side == "light":
		if idl.contains("anakinskywalker") or str(info.get("persona", "")).to_lower() == "anakin":
			return false
		return "jedi" in str(info.get("trait", "")).to_lower()
	return idl.begins_with("darthmaul") or idl.begins_with("darthsidious") or idl.begins_with("aurrasing")


func _duelist_has_usable_saber(char_id: String, mine: Array) -> bool:
	for c in mine:
		if bool(c.get("faceDown", false)):
			continue
		var weapon_id := str(c.get("cardId", ""))
		if _is_lightsaber_card(weapon_id) and _weapon_fits_character(weapon_id, str(c.get("set", "")), char_id):
			return true
	return false


func _duel_pick_glow(card: Dictionary, my_side: String, mine: Array) -> String:
	if not _picking_duel or bool(card.get("faceDown", false)):
		return ""
	var cid := str(card.get("cardId", ""))
	var inst := str(card.get("instanceId", ""))
	var chosen_id := ""
	if not _duel_char_id.is_empty():
		for c in mine:
			if str(c.get("instanceId", "")) == _duel_char_id:
				chosen_id = str(c.get("cardId", ""))
				break
	if chosen_id.is_empty():
		if _is_duelist_card(cid, my_side) and _duelist_has_usable_saber(cid, mine):
			return "play"
		return ""
	if inst == _duel_char_id:
		return "ability"
	if _is_lightsaber_card(cid) and _weapon_fits_character(cid, str(card.get("set", "")), chosen_id):
		return "play"
	return ""


func _on_duel_pressed() -> void:
	_picking_duel = true
	_duel_char_id = ""
	_duel_weapon_id = ""
	status_label.text = "Click a highlighted fighter, then a highlighted lightsaber."
	_refresh()


func _try_send_initiate_duel() -> void:
	if _duel_char_id.is_empty() or _duel_weapon_id.is_empty():
		return
	Connection.get_client().send_message({
		"type": "game_action",
		"action": {"kind": "initiate_duel", "charInstanceId": _duel_char_id, "weaponInstanceId": _duel_weapon_id}
	})
	_picking_duel = false
	_duel_char_id = ""
	_duel_weapon_id = ""


func _in_play_entry(pub: Dictionary, instance_id: String) -> Dictionary:
	if instance_id.is_empty():
		return {}
	for key in ["lightInPlay", "darkInPlay"]:
		for c in pub.get(key, []):
			if str(c.get("instanceId", "")) == instance_id:
				return c
	return {}


func _duel_side_color(side: String) -> Color:
	return SIDE_COLOR_LIGHT if side == "light" else SIDE_COLOR_DARK


func _duel_label(text: String, font_size: int, color: Color, heading: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	if heading:
		l.theme_type_variation = &"HeaderLabel"
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	return l


func _duel_card(parent: Node, card_id: String, side: String, set_name: String, card_size: Vector2) -> Control:
	var card: Control = CardPlaceholderScene.instantiate()
	parent.add_child(card)
	if card.has_method("set_card"):
		card.set_card(card_id, "duel-view", side, set_name)
	if card.has_method("set_board_size"):
		card.set_board_size(card_size)
	else:
		card.custom_minimum_size = card_size
	card.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	card.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if card is BaseButton:
		(card as BaseButton).toggle_mode = false
		(card as BaseButton).focus_mode = Control.FOCUS_NONE
	return card


func _duel_empty_slot(parent: Node, slot_size: Vector2, text: String) -> void:
	var slot := PanelContainer.new()
	slot.custom_minimum_size = slot_size
	slot.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	slot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.08, 0.15, 0.6)
	sb.border_color = Color(0.4, 0.46, 0.62, 0.45)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(6)
	slot.add_theme_stylebox_override("panel", sb)
	var l := _duel_label(text, 12, DUEL_MUTED)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	slot.add_child(l)
	parent.add_child(slot)


func _duel_hit_pips(hits: int, out_at: int, fresh_hits: int, align_left: bool = false) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_BEGIN if align_left else BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 5)
	row.add_child(_duel_label("HITS", 11, DUEL_MUTED, true))
	if out_at <= 0 or out_at > 12:
		row.add_child(_duel_label(str(hits) if out_at <= 0 else "%d / %d" % [hits, out_at], 14, Color(0.93, 0.95, 1.0)))
		return row
	for i in range(out_at):
		var pip := Panel.new()
		pip.custom_minimum_size = Vector2(15, 15)
		pip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		pip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var sb := StyleBoxFlat.new()
		sb.set_corner_radius_all(8)
		sb.set_border_width_all(2)
		if i < hits:
			sb.bg_color = DUEL_HIT_COLOR
			sb.border_color = Color(1.0, 0.74, 0.68)
			sb.shadow_color = Color(DUEL_HIT_COLOR.r, DUEL_HIT_COLOR.g, DUEL_HIT_COLOR.b, 0.55)
			sb.shadow_size = 4
		else:
			sb.bg_color = Color(0.07, 0.09, 0.17)
			sb.border_color = Color(0.36, 0.42, 0.58)
		pip.add_theme_stylebox_override("panel", sb)
		row.add_child(pip)
		if i < hits and i >= hits - fresh_hits:
			pip.pivot_offset = Vector2(7.5, 7.5)
			pip.scale = Vector2(2.0, 2.0)
			var tw := pip.create_tween()
			tw.set_trans(Tween.TRANS_BACK)
			tw.set_ease(Tween.EASE_OUT)
			tw.tween_property(pip, "scale", Vector2.ONE, 0.45)
	row.add_child(_duel_label("%d / %d" % [hits, out_at], 13, Color(0.93, 0.95, 1.0)))
	return row


func _duel_panel_style(accent: Color) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.035 + accent.r * 0.05, 0.05 + accent.g * 0.05, 0.12 + accent.b * 0.05, 0.97)
	sb.border_color = Color(accent.r, accent.g, accent.b, 0.75)
	sb.set_border_width_all(1)
	sb.border_width_top = 3
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 8
	sb.content_margin_bottom = 10
	return sb


func _duel_fighter_panel(pub: Dictionary, char_instance: String, weapon_instance: String, side: String, d: Dictionary, mine: bool, compact: bool, fresh_hits: int = 0) -> Control:
	var col := _duel_side_color(side)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _duel_panel_style(col))
	panel.custom_minimum_size = Vector2(290 if compact else 250, 0)
	var entry := _in_play_entry(pub, char_instance)
	var cid := str(entry.get("cardId", ""))
	var setn := str(entry.get("set", ""))
	var fighter_name := "Fighter"
	if CardCatalog and not cid.is_empty():
		fighter_name = str(CardCatalog.get_card_info(cid, "", setn).get("name", cid))
	var hits := int(d.get("lightHits", 0)) if side == "light" else int(d.get("darkHits", 0))
	var out_at := _printed_damage(pub, char_instance)
	var who := _duel_label("YOU" if mine else "OPPONENT", 13, col.lightened(0.3), true)
	var name_l := _duel_label(fighter_name, 14, Color(0.93, 0.95, 1.0))
	name_l.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name_l.clip_text = true
	var cards := HBoxContainer.new()
	cards.alignment = BoxContainer.ALIGNMENT_CENTER
	cards.add_theme_constant_override("separation", 8)
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 6)
	if compact:
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 12)
		panel.add_child(h)
		h.add_child(cards)
		info.alignment = BoxContainer.ALIGNMENT_CENTER
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(info)
		who.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		name_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		name_l.custom_minimum_size = Vector2(140, 0)
		info.add_child(who)
		info.add_child(name_l)
		info.add_child(_duel_hit_pips(hits, out_at, fresh_hits, true))
	else:
		panel.add_child(info)
		name_l.custom_minimum_size = Vector2(226, 0)
		info.add_child(who)
		info.add_child(cards)
		info.add_child(name_l)
		info.add_child(_duel_hit_pips(hits, out_at, fresh_hits))
	var char_size := Vector2(64, 90) if compact else Vector2(96, 136)
	var weapon_size := Vector2(46, 64) if compact else Vector2(66, 93)
	if cid.is_empty():
		_duel_empty_slot(cards, char_size, "?")
	else:
		_duel_card(cards, cid, side, setn, char_size)
	if not weapon_instance.is_empty():
		var wentry := _in_play_entry(pub, weapon_instance)
		var wid := str(wentry.get("cardId", ""))
		if not wid.is_empty():
			var w := _duel_card(cards, wid, side, str(wentry.get("set", "")), weapon_size)
			w.size_flags_vertical = Control.SIZE_SHRINK_END
	if out_at > 0 and hits >= out_at:
		var ko := _duel_label("DEFEATED", 13, DUEL_HIT_COLOR, true)
		if compact:
			ko.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		info.add_child(ko)
	return panel


func _duel_placeholder_panel(side: String, text: String) -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _duel_panel_style(_duel_side_color(side)))
	panel.custom_minimum_size = Vector2(290, 0)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	panel.add_child(h)
	_duel_empty_slot(h, Vector2(64, 90), "?")
	var info := VBoxContainer.new()
	info.alignment = BoxContainer.ALIGNMENT_CENTER
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(info)
	var who := _duel_label("OPPONENT", 13, _duel_side_color(side).lightened(0.3), true)
	who.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	info.add_child(who)
	var l := _duel_label(text, 14, DUEL_MUTED)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	info.add_child(l)
	return panel


func _duel_my_fighter(d: Dictionary, my_side: String) -> Array:
	if str(d.get("initiator", "")) == my_side:
		return [str(d.get("attackerCharInstanceId", "")), str(d.get("attackerWeaponInstanceId", ""))]
	return [str(d.get("defenderCharInstanceId", "")), str(d.get("defenderWeaponInstanceId", ""))]


func _duel_opp_fighter(d: Dictionary, my_side: String) -> Array:
	if str(d.get("initiator", "")) == my_side:
		return [str(d.get("defenderCharInstanceId", "")), str(d.get("defenderWeaponInstanceId", ""))]
	return [str(d.get("attackerCharInstanceId", "")), str(d.get("attackerWeaponInstanceId", ""))]


func _add_duel_matchup(parent: Node, pub: Dictionary, duel: Variant, my_side: String) -> void:
	var d: Dictionary = duel
	var opp_side: String = "dark" if my_side == "light" else "light"
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	parent.add_child(row)
	var mine := _duel_my_fighter(d, my_side)
	var theirs := _duel_opp_fighter(d, my_side)
	row.add_child(_duel_fighter_panel(pub, str(mine[0]), str(mine[1]), my_side, d, true, true))
	var vs := Label.new()
	vs.text = "VS"
	vs.theme_type_variation = &"TitleLabel"
	vs.add_theme_font_size_override("font_size", 22)
	vs.add_theme_color_override("font_color", DUEL_GOLD)
	vs.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(vs)
	if str(theirs[0]).is_empty():
		row.add_child(_duel_placeholder_panel(opp_side, "Pick below"))
	else:
		row.add_child(_duel_fighter_panel(pub, str(theirs[0]), str(theirs[1]), opp_side, d, false, true))


## Works out what just happened between two duel updates (a block or a hit) so it can be shown briefly.
func _note_duel_exchange(d: Dictionary) -> void:
	var pending: Dictionary = {}
	if d.get("pendingAttack") is Dictionary:
		pending = d.get("pendingAttack")
	var cur := {
		"key": "%s|%s|%s" % [str(pending.get("side", "")), str(pending.get("cardId", "")), str(pending.get("destiny", ""))],
		"card": str(pending.get("cardId", "")),
		"side": str(pending.get("side", "")),
		"dest": int(pending.get("destiny", 0)),
		"set": str(pending.get("set", "")),
		"lh": int(d.get("lightHits", 0)),
		"dh": int(d.get("darkHits", 0)),
	}
	var flash: Dictionary = {}
	if not _duel_prev.is_empty():
		var lh_gain: int = int(cur["lh"]) - int(_duel_prev["lh"])
		var dh_gain: int = int(cur["dh"]) - int(_duel_prev["dh"])
		if lh_gain > 0 or dh_gain > 0:
			var hit_side: String = "light" if lh_gain >= dh_gain else "dark"
			var scored: bool = not str(_duel_prev["card"]).is_empty() and str(_duel_prev["side"]) != hit_side
			flash = {
				"kind": "hit",
				"hit_side": hit_side,
				"hits": maxi(lh_gain, dh_gain),
				"card": str(_duel_prev["card"]) if scored else "",
				"side": str(_duel_prev["side"]),
				"set": str(_duel_prev["set"]),
			}
		elif not str(_duel_prev["card"]).is_empty() and not str(cur["card"]).is_empty() and str(cur["side"]) != str(_duel_prev["side"]):
			flash = {
				"kind": "block",
				"blocker": str(cur["side"]),
				"dest": int(cur["dest"]),
				"card": str(_duel_prev["card"]),
				"side": str(_duel_prev["side"]),
				"set": str(_duel_prev["set"]),
				"block_card": str(cur["card"]),
				"block_set": str(cur["set"]),
			}
	_duel_prev = cur
	if flash.is_empty():
		return
	flash["until"] = Time.get_ticks_msec() + int(DUEL_FLASH_SECS * 1000.0)
	flash["fresh"] = true
	_duel_flash = flash
	_duel_flash_serial += 1
	var serial := _duel_flash_serial
	get_tree().create_timer(DUEL_FLASH_SECS).timeout.connect(func() -> void:
		if serial != _duel_flash_serial:
			return
		_duel_flash = {}
		if _dotf_overlay_kind == "duel_play":
			_refresh()
	)


func _duel_flash_active() -> bool:
	return not _duel_flash.is_empty() and Time.get_ticks_msec() < int(_duel_flash.get("until", 0))


func _duel_pop_in(node: Control) -> void:
	node.modulate = Color(2.2, 2.2, 2.2, 0.0)
	var tw := node.create_tween()
	tw.set_ease(Tween.EASE_OUT)
	tw.tween_property(node, "modulate", Color.WHITE, 0.3)


func _duel_center_stage(d: Dictionary, pending: Dictionary, my_side: String) -> Control:
	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.015, 0.02, 0.06, 0.85)
	sb.border_color = Color(0.86, 0.72, 0.32, 0.35)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(10)
	panel.add_theme_stylebox_override("panel", sb)
	panel.custom_minimum_size = Vector2(280, 0)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 6)
	panel.add_child(v)
	if _duel_flash_active():
		var fresh := bool(_duel_flash.get("fresh", false))
		var title: Label
		if str(_duel_flash.get("kind", "")) == "hit":
			var hit_side := str(_duel_flash.get("hit_side", ""))
			var n := int(_duel_flash.get("hits", 1))
			sb.border_color = Color(DUEL_HIT_COLOR.r, DUEL_HIT_COLOR.g, DUEL_HIT_COLOR.b, 0.8)
			title = _duel_label("HIT!", 34, DUEL_HIT_COLOR, true)
			v.add_child(title)
			var who := "You take" if hit_side == my_side else "Opponent takes"
			v.add_child(_duel_label("%s %d hit%s" % [who, n, "" if n == 1 else "s"], 15, Color(0.93, 0.95, 1.0)))
			v.add_child(_duel_label("Then you swing." if hit_side == my_side else "Then they swing.", 14, DUEL_MUTED))
			var cid := str(_duel_flash.get("card", ""))
			if not cid.is_empty():
				_duel_card(v, cid, str(_duel_flash.get("side", "")), str(_duel_flash.get("set", "")), Vector2(70, 99))
		else:
			var blocker := str(_duel_flash.get("blocker", ""))
			sb.border_color = Color(DUEL_GOLD.r, DUEL_GOLD.g, DUEL_GOLD.b, 0.8)
			title = _duel_label("BLOCKED!", 30, DUEL_GOLD, true)
			v.add_child(title)
			var dest := int(_duel_flash.get("dest", 0))
			v.add_child(_duel_label(("You matched their %d. That card is now your swing." if blocker == my_side else "They matched your %d. That card is now their swing.") % dest, 15, Color(0.93, 0.95, 1.0)))
			var pair := HBoxContainer.new()
			pair.alignment = BoxContainer.ALIGNMENT_CENTER
			pair.add_theme_constant_override("separation", 8)
			v.add_child(pair)
			_duel_card(pair, str(_duel_flash.get("card", "")), str(_duel_flash.get("side", "")), str(_duel_flash.get("set", "")), Vector2(64, 90))
			pair.add_child(_duel_label("=", 22, DUEL_GOLD, true))
			_duel_card(pair, str(_duel_flash.get("block_card", "")), blocker, str(_duel_flash.get("block_set", "")), Vector2(64, 90))
		if fresh:
			_duel_pop_in(title)
		return panel
	if not pending.is_empty() and not str(pending.get("cardId", "")).is_empty():
		var pside := str(pending.get("side", ""))
		v.add_child(_duel_label("YOUR ATTACK" if pside == my_side else "THEIR ATTACK", 13, _duel_side_color(pside).lightened(0.3), true))
		_duel_card(v, str(pending.get("cardId", "")), pside, str(pending.get("set", "")), Vector2(96, 136))
		v.add_child(_duel_label("Destiny %d" % int(pending.get("destiny", 0)), 16, DUEL_GOLD, true))
		return panel
	var attacker := str(d.get("currentAttacker", ""))
	v.add_child(_duel_label("YOUR ATTACK" if attacker == my_side else "THEIR ATTACK", 13, _duel_side_color(attacker).lightened(0.3), true))
	_duel_empty_slot(v, Vector2(96, 136), "No card yet")
	return panel


func _duel_result_lines(result: Dictionary, my_side: String) -> Dictionary:
	var mine_name: String = str(result.get("lightName", "You")) if my_side == "light" else str(result.get("darkName", "You"))
	var opp_name: String = str(result.get("darkName", "Opponent")) if my_side == "light" else str(result.get("lightName", "Opponent"))
	var ko: String = str(result.get("koSide", ""))
	var milled_side: String = str(result.get("milledSide", ""))
	var milled: int = int(result.get("milled", 0))
	if not ko.is_empty():
		var loser_key := "light" if ko == "light" else "dark"
		var winner_key := "dark" if ko == "light" else "light"
		var damage := int(result.get(loser_key + "Damage", 0))
		var hits_taken := int(result.get(loser_key + "Hits", 0))
		var hits_landed := int(result.get(winner_key + "Hits", 0))
		var loser_name := mine_name if ko == my_side else opp_name
		var you := ko == my_side
		var note := "%s took %d hits and fell at damage %d. Cards lost are that damage minus the %d hits %s landed, so %d." % [
			loser_name, hits_taken, damage, hits_landed, "you" if you else "they", milled]
		if you:
			return {"title": "DEFEATED", "color": DUEL_HIT_COLOR, "sub": "%s is defeated" % mine_name, "note": note}
		return {"title": "VICTORY", "color": DUEL_GOLD, "sub": "%s is defeated" % opp_name, "note": note}
	if milled > 0 and milled_side == my_side:
		return {"title": "NO KNOCKOUT", "color": Color(0.93, 0.95, 1.0), "sub": "Both fighters stay in play",
			"note": "You took more hits. You lose %d cards, the difference in hits. Neither fighter is discarded." % milled}
	if milled > 0:
		return {"title": "NO KNOCKOUT", "color": Color(0.93, 0.95, 1.0), "sub": "Both fighters stay in play",
			"note": "They took more hits. They lose %d cards, the difference in hits. Neither fighter is discarded." % milled}
	return {"title": "NO KNOCKOUT", "color": Color(0.93, 0.95, 1.0), "sub": "Both fighters stay in play",
		"note": "Hits were tied. Nobody loses cards."}


func _maybe_show_duel_result(pub: Dictionary, my_side: String) -> void:
	var result: Variant = pub.get("lastDuelResult", null)
	if not (result is Dictionary):
		return
	var id := str(result.get("id", ""))
	if id.is_empty() or id == _seen_duel_result:
		return
	if _dotf_overlay_kind == "duel_result":
		return
	_seen_duel_result = id
	var r: Dictionary = result
	var lines := _duel_result_lines(r, my_side)
	var vbox := _begin_choice_overlay("duel_result", "Duel over")
	var title := _duel_label(str(lines["title"]), 34, lines["color"], true)
	title.theme_type_variation = &"TitleLabel"
	vbox.add_child(title)
	_duel_pop_in(title)
	vbox.add_child(_duel_label(str(lines["sub"]), 16, Color(0.93, 0.95, 1.0)))
	var ko_side := str(r.get("koSide", ""))
	if not ko_side.is_empty():
		var ko_id := str(r.get(ko_side + "CardId", ""))
		if not ko_id.is_empty():
			_duel_card(vbox, ko_id, ko_side, str(r.get(ko_side + "Set", "")), Vector2(96, 136))
	var opp_side: String = "dark" if my_side == "light" else "light"
	var scores := HBoxContainer.new()
	scores.alignment = BoxContainer.ALIGNMENT_CENTER
	scores.add_theme_constant_override("separation", 16)
	vbox.add_child(scores)
	for side in [my_side, opp_side]:
		var box := PanelContainer.new()
		box.add_theme_stylebox_override("panel", _duel_panel_style(_duel_side_color(side)))
		box.custom_minimum_size = Vector2(240, 0)
		scores.add_child(box)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 6)
		box.add_child(col)
		col.add_child(_duel_label("YOU" if side == my_side else "OPPONENT", 13, _duel_side_color(side).lightened(0.3), true))
		var side_id := str(r.get(side + "CardId", ""))
		if not side_id.is_empty():
			_duel_card(col, side_id, side, str(r.get(side + "Set", "")), Vector2(72, 102))
		var fighter := _duel_label(str(r.get(side + "Name", "")), 14, Color(0.93, 0.95, 1.0))
		fighter.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		fighter.clip_text = true
		fighter.custom_minimum_size = Vector2(216, 0)
		col.add_child(fighter)
		col.add_child(_duel_hit_pips(int(r.get(side + "Hits", 0)), int(r.get(side + "Damage", 0)), 0))
	var note := _duel_label(str(lines["note"]), 14, DUEL_MUTED)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.custom_minimum_size = Vector2(500, 0)
	vbox.add_child(note)
	var ok := Button.new()
	ok.text = "Continue"
	_style_action_button(ok, "primary")
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(_clear_dotf_overlay)
	vbox.add_child(ok)


func _duel_hand_choice(hand_area: VBoxContainer, ask: String, options: Array) -> void:
	for child in hand_area.get_children():
		hand_area.remove_child(child)
		child.queue_free()
	var l := _duel_label(ask, 16, DUEL_GOLD)
	hand_area.add_child(l)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	hand_area.add_child(row)
	for opt in options:
		var b := Button.new()
		b.text = str(opt["text"])
		_style_action_button(b, str(opt["kind"]))
		b.pressed.connect(opt["cb"])
		row.add_child(b)
	var back := Button.new()
	back.text = "Back"
	_style_action_button(back, "secondary")
	back.custom_minimum_size = Vector2(110, 44)
	back.pressed.connect(func() -> void: _refresh())
	row.add_child(back)


func _build_duel_play_screen(pub: Dictionary, d: Dictionary, my_side: String) -> void:
	for child in _dotf_overlay.get_children():
		_dotf_overlay.remove_child(child)
		child.queue_free()
	var vp: Vector2 = get_viewport().get_visible_rect().size
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.01, 0.02, 0.06, 0.82)
	_dotf_overlay.add_child(bg)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dotf_overlay.add_child(center)
	var panel := PanelContainer.new()
	var panel_w: float = minf(vp.x - 48.0, 1040.0)
	panel.custom_minimum_size = Vector2(panel_w, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.12, 0.98)
	style.border_color = Color(0.86, 0.72, 0.32, 0.7)
	style.set_border_width_all(2)
	style.set_corner_radius_all(14)
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 12
	style.content_margin_bottom = 14
	style.shadow_color = Color(0, 0, 0, 0.6)
	style.shadow_size = 20
	panel.add_theme_stylebox_override("panel", style)
	center.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)

	var header := HBoxContainer.new()
	header.alignment = BoxContainer.ALIGNMENT_CENTER
	header.add_theme_constant_override("separation", 16)
	vbox.add_child(header)
	for i in range(3):
		if i == 1:
			var t := Label.new()
			t.text = "DUEL"
			t.theme_type_variation = &"TitleLabel"
			t.add_theme_font_size_override("font_size", 30)
			t.add_theme_color_override("font_color", DUEL_GOLD)
			header.add_child(t)
			continue
		var line := ColorRect.new()
		line.custom_minimum_size = Vector2(110, 2)
		line.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		line.color = Color(0.86, 0.72, 0.32, 0.5)
		header.add_child(line)
	vbox.add_child(_duel_label("You swing first. A match blocks and becomes their swing. A miss is a hit, then they swing.", 13, DUEL_MUTED))

	var pending: Dictionary = {}
	if d.get("pendingAttack") is Dictionary:
		pending = d.get("pendingAttack")
	var opp_side: String = "dark" if my_side == "light" else "light"
	var fresh_hit_side := ""
	var fresh_hits := 0
	if _duel_flash_active() and bool(_duel_flash.get("fresh", false)) and str(_duel_flash.get("kind", "")) == "hit":
		fresh_hit_side = str(_duel_flash.get("hit_side", ""))
		fresh_hits = int(_duel_flash.get("hits", 0))
	var arena := HBoxContainer.new()
	arena.alignment = BoxContainer.ALIGNMENT_CENTER
	arena.add_theme_constant_override("separation", 16)
	vbox.add_child(arena)
	var mine := _duel_my_fighter(d, my_side)
	var theirs := _duel_opp_fighter(d, my_side)
	arena.add_child(_duel_fighter_panel(pub, str(mine[0]), str(mine[1]), my_side, d, true, false, fresh_hits if fresh_hit_side == my_side else 0))
	arena.add_child(_duel_center_stage(d, pending, my_side))
	arena.add_child(_duel_fighter_panel(pub, str(theirs[0]), str(theirs[1]), opp_side, d, false, false, fresh_hits if fresh_hit_side == opp_side else 0))
	_duel_flash["fresh"] = false

	var hand: Array = d.get("yourDuelHand", [])
	var attacker: String = str(d.get("currentAttacker", ""))
	var my_turn_to_play := false
	var need := -1
	var prompt_text := ""
	if hand.is_empty():
		prompt_text = "You have no duel cards left"
	elif not pending.is_empty() and str(pending.get("side", "")) != my_side:
		my_turn_to_play = true
		need = int(pending.get("destiny", 0))
		prompt_text = "Their swing is %d. Match it and that card becomes your swing. Any other card: you take the hit, then you swing." % need
	elif pending.is_empty() and attacker == my_side:
		my_turn_to_play = true
		prompt_text = "Your swing. Play any card. They must match that number."
	elif not pending.is_empty():
		prompt_text = "Your swing is %d. If they match it, that card becomes their swing. If they miss, they take the hit and then they swing." % int(pending.get("destiny", 0))
	else:
		prompt_text = "Their swing next. Wait for them to play a card."
	var prompt := PanelContainer.new()
	prompt.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var psb := StyleBoxFlat.new()
	psb.set_corner_radius_all(18)
	psb.set_border_width_all(1)
	psb.content_margin_left = 22
	psb.content_margin_right = 22
	psb.content_margin_top = 6
	psb.content_margin_bottom = 6
	if my_turn_to_play:
		psb.bg_color = Color(0.3, 0.24, 0.08, 0.55)
		psb.border_color = Color(DUEL_GOLD.r, DUEL_GOLD.g, DUEL_GOLD.b, 0.8)
	else:
		psb.bg_color = Color(0.06, 0.08, 0.15, 0.8)
		psb.border_color = Color(0.4, 0.46, 0.62, 0.4)
	prompt.add_theme_stylebox_override("panel", psb)
	prompt.add_child(_duel_label(prompt_text, 16, DUEL_GOLD if my_turn_to_play else DUEL_MUTED))
	vbox.add_child(prompt)

	var hand_area := VBoxContainer.new()
	hand_area.add_theme_constant_override("separation", 6)
	vbox.add_child(hand_area)
	var caption_row := HBoxContainer.new()
	caption_row.alignment = BoxContainer.ALIGNMENT_CENTER
	caption_row.add_theme_constant_override("separation", 18)
	hand_area.add_child(caption_row)
	caption_row.add_child(_duel_label("YOUR DUEL CARDS  %d" % hand.size(), 12, DUEL_MUTED, true))
	var opp_count: int = int(d.get("darkHandCount" if my_side == "light" else "lightHandCount", 0))
	caption_row.add_child(_duel_label("OPPONENT HOLDS  %d" % opp_count, 12, DUEL_MUTED, true))
	var my_hits: int = int(d.get("lightHits", 0)) if my_side == "light" else int(d.get("darkHits", 0))
	var used: Array = d.get("hitRemovalUsed", [])
	for c in hand:
		if not (c is Dictionary):
			continue
		var rid: String = str(c.get("instanceId", ""))
		var rcid: String = str(c.get("cardId", ""))
		if my_hits > 0 and not used.has(rid) and _card_bonus_text(rcid).contains("duel:removehit"):
			var remove_btn := Button.new()
			remove_btn.text = "Remove 1 hit"
			_style_action_button(remove_btn, "secondary")
			remove_btn.custom_minimum_size = Vector2(140, 34)
			remove_btn.pressed.connect(func() -> void:
				Connection.get_client().send_message({"type": "game_action", "action": {"kind": "duel_remove_hit", "instanceId": rid}})
			)
			caption_row.add_child(remove_btn)
			break
	var pad := MarginContainer.new()
	pad.add_theme_constant_override("margin_top", 4)
	pad.add_theme_constant_override("margin_bottom", 4)
	hand_area.add_child(pad)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	pad.add_child(row)
	var n: int = maxi(hand.size(), 1)
	var card_w: float = clampf((panel_w - 60.0 - 8.0 * (n - 1)) / n, 60.0, 96.0)
	var card_size := Vector2(card_w, roundf(card_w * 136.0 / 96.0))
	for entry in hand:
		if not (entry is Dictionary):
			continue
		var inst: String = str(entry.get("instanceId", ""))
		var cid: String = str(entry.get("cardId", ""))
		var card: Control = CardPlaceholderScene.instantiate()
		row.add_child(card)
		card.set_card(cid, inst, my_side, str(entry.get("set", "")))
		if card.has_method("set_board_size"):
			card.set_board_size(card_size)
		if card is BaseButton:
			(card as BaseButton).toggle_mode = false
		var printed := 0
		if CardCatalog:
			printed = int(CardCatalog.get_card_info(cid, "").get("destiny", 0))
		if not my_turn_to_play:
			card.modulate = Color(1, 1, 1, 0.55)
		elif card.has_method("set_action_glow") and (need < 0 or printed == need):
			card.set_action_glow("play")
		card.card_selected.connect(func(_picked: String) -> void:
			if not my_turn_to_play:
				status_label.text = "Wait for the other player to play a card."
				return
			var bonus := _card_bonus_text(cid)
			var becomes_attack := pending.is_empty() or printed == int(pending.get("destiny", -1))
			var play_normal := func() -> void: _play_duel_card(inst, cid, false)
			if bonus.contains("duel:discard:draw2"):
				var draw_two := func() -> void: Connection.get_client().send_message({"type": "game_action", "action": {"kind": "duel_discard_draw", "instanceId": inst}})
				_duel_hand_choice(hand_area, "Play this card, or discard it to draw 2?", [
					{"text": "Play card", "kind": "primary", "cb": play_normal},
					{"text": "Discard, draw 2", "kind": "secondary", "cb": draw_two},
				])
				return
			if bonus.contains("duel:discard:extrahit2") and becomes_attack:
				var extra_hits := func() -> void: _play_duel_card(inst, cid, true)
				_duel_hand_choice(hand_area, "Discard it for this swing. If they miss, they take 3 hits. If they match the number, it is blocked and the card stays discarded.", [
					{"text": "Play normally", "kind": "secondary", "cb": play_normal},
					{"text": "Discard for +2 hits", "kind": "primary", "cb": extra_hits},
				])
				return
			_play_duel_card(inst, cid, false)
		)


func _update_duel_ui(state: RefCounted, pub: Dictionary, my_side: String) -> void:
	var d: Variant = pub.get("duelState", null)
	if not (d is Dictionary):
		_duel_prev = {}
		_duel_flash = {}
		if _dotf_overlay_kind.begins_with("duel") and _dotf_overlay_kind != "duel_result":
			_clear_dotf_overlay()
		_maybe_show_duel_result(pub, my_side)
		return
	var step: String = str(d.get("step", ""))
	var initiator: String = str(d.get("initiator", ""))
	if step == "choose_target" and initiator == my_side and _dotf_overlay_kind != "duel_target":
		var vbox := _begin_choice_overlay("duel_target", "Duel · pick their fighter")
		_add_duel_matchup(vbox, pub, d, my_side)
		vbox.add_child(_duel_label("Click the character you want to duel.", 14, DUEL_MUTED))
		var opp_side: String = "dark" if my_side == "light" else "light"
		var opp_play: Array = pub.get("lightInPlay" if opp_side == "light" else "darkInPlay", [])
		var chars: Array = []
		for c in opp_play:
			var info: Dictionary = CardCatalog.get_card_info(c.get("cardId", ""), "") if CardCatalog else {}
			if str(info.get("type", "")).to_lower() == "character" and not c.get("faceDown", false):
				chars.append(c)
		_add_card_row(vbox, chars, opp_side, func(inst: String, _cid: String) -> void:
			Connection.get_client().send_message({"type": "game_action", "action": {"kind": "choose_duel_target", "defenderCharInstanceId": inst}})
			_clear_dotf_overlay()
		)
		return
	if step == "defender_respond" and initiator != my_side and _dotf_overlay_kind != "duel_defend":
		var mine: Array = pub.get("lightInPlay" if my_side == "light" else "darkInPlay", [])
		var current_defender := str(d.get("defenderCharInstanceId", ""))
		var duelists: Array = []
		var weapons: Array = []
		for c in mine:
			if bool(c.get("faceDown", false)):
				continue
			var cid: String = c.get("cardId", "")
			if _is_duelist_card(cid, my_side) and str(c.get("instanceId", "")) != current_defender:
				duelists.append(c)
			var info: Dictionary = CardCatalog.get_card_info(cid, "") if CardCatalog else {}
			if str(info.get("type", "")).to_lower() == "weapon" and _weapon_fits_character(cid, str(info.get("set", "")), _card_id_at(mine, current_defender)):
				weapons.append(c)
		if duelists.is_empty() and weapons.is_empty():
			if _dotf_overlay_kind != "duel_defend_auto":
				_dotf_overlay_kind = "duel_defend_auto"
				Connection.get_client().send_message({"type": "game_action", "action": {"kind": "duel_defender_ready"}})
			return
		var vbox := _begin_choice_overlay("duel_defend", "Duel · you've been challenged")
		_add_duel_matchup(vbox, pub, d, my_side)
		vbox.add_child(_duel_label("Keep your fighter, swap to another, or add a weapon.", 14, DUEL_MUTED))
		var accept := Button.new()
		accept.text = "Keep this fighter"
		_style_action_button(accept, "primary")
		accept.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		accept.pressed.connect(func() -> void:
			Connection.get_client().send_message({"type": "game_action", "action": {"kind": "duel_defender_ready"}})
			_clear_dotf_overlay()
		)
		vbox.add_child(accept)
		if not duelists.is_empty():
			vbox.add_child(_duel_label("SWAP FIGHTER", 12, DUEL_MUTED, true))
			_add_card_row(vbox, duelists, my_side, func(inst: String, _cid: String) -> void:
				Connection.get_client().send_message({"type": "game_action", "action": {"kind": "duel_defender_ready", "swapCharInstanceId": inst}})
				_clear_dotf_overlay()
			)
		if not weapons.is_empty():
			vbox.add_child(_duel_label("ADD A WEAPON", 12, DUEL_MUTED, true))
			_add_card_row(vbox, weapons, my_side, func(inst: String, _cid: String) -> void:
				Connection.get_client().send_message({"type": "game_action", "action": {"kind": "duel_defender_ready", "weaponInstanceId": inst}})
				_clear_dotf_overlay()
			)
		return
	if step == "play":
		if _dotf_overlay_kind != "duel_play":
			_clear_dotf_overlay()
			_dotf_overlay_kind = "duel_play"
			_dotf_overlay = CanvasLayer.new()
			_dotf_overlay.layer = 185
			add_child(_dotf_overlay)
		var dd: Dictionary = d
		_note_duel_exchange(dd)
		_build_duel_play_screen(pub, dd, my_side)


func _on_your_hs_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_browse_hyperspace(true)


func _on_opp_hs_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_browse_hyperspace(false)


func _browse_hyperspace(yours: bool) -> void:
	var state: RefCounted = Connection.get_state()
	var pub: Dictionary = state.game_state.get("publicState", {})
	var my_side: String = state.game_side
	var key: String = ("lightHyperspace" if my_side == "light" else "darkHyperspace") if yours else ("darkHyperspace" if my_side == "light" else "lightHyperspace")
	var side: String = my_side if yours else ("dark" if my_side == "light" else "light")
	var ships: Array = pub.get(key, [])
	if _hs_browse_overlay and is_instance_valid(_hs_browse_overlay):
		_hs_browse_overlay.queue_free()
	_hs_browse_overlay = CanvasLayer.new()
	_hs_browse_overlay.layer = 170
	add_child(_hs_browse_overlay)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0, 0, 0, 0.65)
	bg.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and ev.pressed:
			if _hs_browse_overlay:
				_hs_browse_overlay.queue_free()
				_hs_browse_overlay = null
	)
	_hs_browse_overlay.add_child(bg)
	var vbox := _begin_choice_overlay("hs_browse", "Hyperspace")
	# _begin_choice_overlay replaced _dotf_overlay; attach browse to that overlay instead
	_add_card_row(vbox, ships, side, func(inst: String, cid: String) -> void:
		if not yours:
			return
		var g: Dictionary = Connection.get_state().game_state
		if g.get("phase", "") != "deploy" or g.get("turnSide", "") != my_side:
			return
		if not _card_bonus_text(cid).contains("discardsearcher"):
			return
		Connection.get_client().send_message({
			"type": "game_action",
			"action": { "kind": "start_in_play_deploy", "instanceId": inst }
		})
		_clear_dotf_overlay()
		if _hs_browse_overlay:
			_hs_browse_overlay.queue_free()
			_hs_browse_overlay = null
	)
	var close_btn := Button.new()
	close_btn.text = "Close"
	close_btn.pressed.connect(func() -> void:
		_clear_dotf_overlay()
		if _hs_browse_overlay:
			_hs_browse_overlay.queue_free()
			_hs_browse_overlay = null
	)
	vbox.add_child(close_btn)


func _build_pile_frames() -> void:
	for wrapper in [your_deck_wrapper, your_discard_wrapper, opp_deck_wrapper, opp_discard_wrapper]:
		if wrapper:
			_ensure_hs_empty_frame(wrapper as Control)


func _ensure_hs_empty_frame(wrapper: Control) -> Panel:
	var frame: Panel = wrapper.get_node_or_null("EmptyFrame") as Panel
	if frame:
		return frame
	frame = Panel.new()
	frame.name = "EmptyFrame"
	frame.set_anchors_preset(Control.PRESET_FULL_RECT)
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.04, 0.07, 0.15, 0.55)
	style.border_color = Color(0.45, 0.62, 0.9, 0.45)
	style.set_border_width_all(1)
	style.set_corner_radius_all(5)
	frame.add_theme_stylebox_override("panel", style)
	wrapper.add_child(frame)
	wrapper.move_child(frame, 0)
	var caption := Label.new()
	caption.text = "Empty"
	caption.set_anchors_preset(Control.PRESET_FULL_RECT)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	caption.add_theme_font_size_override("font_size", 11)
	caption.add_theme_color_override("font_color", Color(0.7, 0.82, 0.95, 0.7))
	caption.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.add_child(caption)
	return frame


func _set_hs_pile_contents(wrapper: Control, tex: TextureRect, count_lbl: Label, ships: Array, side: String) -> void:
	var empty_frame: Panel = _ensure_hs_empty_frame(wrapper)
	if ships.is_empty():
		if tex:
			tex.visible = false
			tex.texture = null
		if count_lbl:
			count_lbl.visible = false
			count_lbl.text = ""
		empty_frame.visible = true
		return
	empty_frame.visible = false
	if tex:
		tex.visible = true
		tex.texture = _load_card_texture_for_id(ships[ships.size() - 1].get("cardId", ""), side)
	if count_lbl:
		count_lbl.text = str(ships.size())
		count_lbl.visible = true


func _update_hyperspace_piles(pub: Dictionary, my_side: String) -> void:
	var use_hs: bool = _uses_hyperspace(pub)
	var my_ships: Array = pub.get("lightHyperspace" if my_side == "light" else "darkHyperspace", [])
	var opp_ships: Array = pub.get("darkHyperspace" if my_side == "light" else "lightHyperspace", [])
	var opp_side: String = "dark" if my_side == "light" else "light"
	var your_col: Control = null
	var opp_col: Control = null
	if your_hs_wrapper:
		your_col = your_hs_wrapper.get_parent() as Control
	if opp_hs_wrapper:
		opp_col = opp_hs_wrapper.get_parent() as Control
	if your_col:
		your_col.visible = use_hs
	if opp_col:
		opp_col.visible = use_hs
	if your_hs_wrapper:
		your_hs_wrapper.visible = use_hs
		_set_hs_pile_contents(your_hs_wrapper, your_hs_tex, your_hs_count, my_ships if use_hs else [], my_side)
		var hs_ready := false
		if use_hs:
			var hs_state: Dictionary = Connection.get_state().game_state if Connection.get_state() else {}
			var hs_phase := str(hs_state.get("phase", ""))
			var hs_turn := str(hs_state.get("turnSide", ""))
			for ship in my_ships:
				if _table_ability_glow(ship, pub, my_side, hs_phase, hs_turn) == "ability":
					hs_ready = true
					break
		if your_hs_tex:
			your_hs_tex.modulate = Color(1.15, 1.05, 0.55) if hs_ready else Color.WHITE
		your_hs_wrapper.tooltip_text = "A ship here can deploy a card from your deck." if hs_ready else ""
	if opp_hs_wrapper:
		opp_hs_wrapper.visible = use_hs
		_set_hs_pile_contents(opp_hs_wrapper, opp_hs_tex, opp_hs_count, opp_ships if use_hs else [], opp_side)


const EVAC_TRANSPORT_COMPLETE_DELAY: float = 4.5
const EVAC_BATTLE_READ_DELAY: float = 5.0


func _show_transport_complete_then_dismiss(result: Dictionary, my_side: String) -> void:
	if _evacuation_overlay:
		_evacuation_overlay.queue_free()
		_evacuation_overlay = null
	_evacuation_overlay = CanvasLayer.new()
	_evacuation_overlay.layer = 200
	add_child(_evacuation_overlay)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.05, 0.05, 0.15, 0.85)
	_evacuation_overlay.add_child(bg)
	_evacuation_panel = PanelContainer.new()
	_evacuation_panel.set_anchors_preset(Control.PRESET_CENTER)
	_evacuation_panel.offset_left = -280
	_evacuation_panel.offset_top = -180
	_evacuation_panel.offset_right = 280
	_evacuation_panel.offset_bottom = 180
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.14, 0.22, 0.98)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.3, 0.7, 0.5, 0.9)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 20
	style.content_margin_bottom = 20
	_evacuation_panel.add_theme_stylebox_override("panel", style)
	_evacuation_overlay.add_child(_evacuation_panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	_evacuation_panel.add_child(vbox)
	var evac_side: String = result.get("evacuatingSide", "")
	var transport_card_id: String = result.get("transportCardId", "")
	var stacked_ids: Array = result.get("stackedCardIds", [])
	# Transport card on top
	var transport_row := HBoxContainer.new()
	transport_row.alignment = BoxContainer.ALIGNMENT_CENTER
	transport_row.add_theme_constant_override("separation", 8)
	vbox.add_child(transport_row)
	var transport_tex := TextureRect.new()
	transport_tex.custom_minimum_size = Vector2(100, 140)
	transport_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	transport_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	transport_tex.texture = _load_card_texture_for_id(transport_card_id, evac_side)
	transport_row.add_child(transport_tex)
	# Stacked cards stacked under (smaller, shown in a row)
	var stacked_row := HBoxContainer.new()
	stacked_row.alignment = BoxContainer.ALIGNMENT_CENTER
	stacked_row.add_theme_constant_override("separation", 4)
	vbox.add_child(stacked_row)
	for card_id in stacked_ids:
		var card_tex := TextureRect.new()
		card_tex.custom_minimum_size = Vector2(50, 70)
		card_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		card_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
		card_tex.texture = _load_card_texture_for_id(str(card_id), evac_side)
		stacked_row.add_child(card_tex)
	var title := Label.new()
	title.text = "Transport Complete"
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color(0.3, 1.0, 0.5, 1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)
	var desc := Label.new()
	desc.text = "%d card%s evacuated to deck." % [stacked_ids.size(), "s" if stacked_ids.size() != 1 else ""]
	desc.add_theme_font_size_override("font_size", 14)
	desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(desc)
	get_tree().create_timer(EVAC_TRANSPORT_COMPLETE_DELAY).timeout.connect(func() -> void:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": {"kind": "dismiss_evacuation_result"}
		})
		if _evacuation_overlay:
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
		_refresh()
	)


func _show_hyperspace_evac_failed(result: Dictionary, my_side: String) -> void:
	if _evacuation_overlay:
		_evacuation_overlay.queue_free()
		_evacuation_overlay = null
	_evacuation_overlay = CanvasLayer.new()
	_evacuation_overlay.layer = 200
	add_child(_evacuation_overlay)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.05, 0.05, 0.15, 0.85)
	_evacuation_overlay.add_child(bg)
	_evacuation_panel = PanelContainer.new()
	_evacuation_panel.set_anchors_preset(Control.PRESET_CENTER)
	_evacuation_panel.offset_left = -280
	_evacuation_panel.offset_top = -180
	_evacuation_panel.offset_right = 280
	_evacuation_panel.offset_bottom = 180
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.18, 0.08, 0.1, 0.98)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.85, 0.3, 0.3, 0.9)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 20
	style.content_margin_bottom = 20
	_evacuation_panel.add_theme_stylebox_override("panel", style)
	_evacuation_overlay.add_child(_evacuation_panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	_evacuation_panel.add_child(vbox)
	var evac_side: String = result.get("evacuatingSide", "")
	var stacked_ids: Array = result.get("stackedCardIds", [])
	var title := Label.new()
	title.text = "Evacuation Failed"
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color(1.0, 0.4, 0.35, 1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)
	var desc := Label.new()
	desc.text = "No transports survived. %d card%s discarded." % [stacked_ids.size(), "s" if stacked_ids.size() != 1 else ""]
	desc.add_theme_font_size_override("font_size", 14)
	desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(desc)
	if stacked_ids.size() > 0:
		var stacked_row := HBoxContainer.new()
		stacked_row.alignment = BoxContainer.ALIGNMENT_CENTER
		stacked_row.add_theme_constant_override("separation", 4)
		vbox.add_child(stacked_row)
		for card_id in stacked_ids:
			var card_tex := TextureRect.new()
			card_tex.custom_minimum_size = Vector2(50, 70)
			card_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			card_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
			card_tex.texture = _load_card_texture_for_id(str(card_id), evac_side)
			stacked_row.add_child(card_tex)
	get_tree().create_timer(EVAC_TRANSPORT_COMPLETE_DELAY).timeout.connect(func() -> void:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": {"kind": "dismiss_evacuation_result"}
		})
		if _evacuation_overlay:
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
		_refresh()
	)


func _show_evacuation_result(result: Dictionary, my_side: String) -> void:
	if _evacuation_overlay:
		_evacuation_overlay.queue_free()
		_evacuation_overlay = null
	_evacuation_overlay = CanvasLayer.new()
	_evacuation_overlay.layer = 200
	add_child(_evacuation_overlay)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.05, 0.05, 0.15, 0.85)
	_evacuation_overlay.add_child(bg)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_evacuation_overlay.add_child(scroll)
	var center := CenterContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	center.custom_minimum_size = Vector2(680, 0)
	scroll.add_child(center)
	_evacuation_panel = PanelContainer.new()
	_evacuation_panel.custom_minimum_size = Vector2(640, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.12, 0.2, 0.98)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.5, 0.7, 1.0, 0.8)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	_evacuation_panel.add_theme_stylebox_override("panel", style)
	center.add_child(_evacuation_panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	_evacuation_panel.add_child(vbox)
	var evac_side: String = result.get("evacuatingSide", "")
	var opp_side: String = "dark" if evac_side == "light" else "light"
	var is_mine: bool = (evac_side == my_side)
	var transport_card_id: String = result.get("transportCardId", "")
	var transport_name: String = result.get("transportName", "Transport")
	var planet: String = result.get("targetPlanet", "")
	var outcome: String = result.get("outcome", "")
	var intercepted: bool = result.get("intercepted", false)
	# Step 1: Title — "Starship Battle!" shown immediately
	var battle_title := Label.new()
	battle_title.text = "Starship Battle!"
	battle_title.add_theme_font_size_override("font_size", 18)
	battle_title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.3, 1))
	battle_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(battle_title)
	var planet_lbl := Label.new()
	planet_lbl.text = "at %s" % planet
	planet_lbl.add_theme_font_size_override("font_size", 12)
	planet_lbl.add_theme_color_override("font_color", Color(0.7, 0.8, 0.9))
	planet_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(planet_lbl)
	# Step 2: Show both ships side by side
	var ships_row := HBoxContainer.new()
	ships_row.alignment = BoxContainer.ALIGNMENT_CENTER
	ships_row.add_theme_constant_override("separation", 24)
	vbox.add_child(ships_row)
	var transport_power: int = int(result.get("transportPower", 0))
	# Transport side
	var transport_col := VBoxContainer.new()
	transport_col.add_theme_constant_override("separation", 4)
	ships_row.add_child(transport_col)
	var t_label := Label.new()
	t_label.text = "Your Transport" if is_mine else "Opponent's Transport"
	t_label.add_theme_font_size_override("font_size", 11)
	t_label.add_theme_color_override("font_color", Color(0.4, 0.7, 1.0) if is_mine else Color(1.0, 0.5, 0.4))
	t_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	transport_col.add_child(t_label)
	var transport_tex := TextureRect.new()
	transport_tex.custom_minimum_size = Vector2(110, 154)
	transport_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	transport_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	transport_tex.texture = _load_card_texture_for_id(transport_card_id, evac_side)
	transport_col.add_child(transport_tex)
	var t_power_lbl := Label.new()
	t_power_lbl.text = "Power: %d" % transport_power
	t_power_lbl.add_theme_font_size_override("font_size", 13)
	t_power_lbl.add_theme_color_override("font_color", Color(1, 1, 1))
	t_power_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	transport_col.add_child(t_power_lbl)
	# VS label
	var vs_label := Label.new()
	vs_label.text = "vs."
	vs_label.add_theme_font_size_override("font_size", 16)
	vs_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.8))
	ships_row.add_child(vs_label)
	# Starfighter side (hidden initially, revealed in step)
	var sf_col := VBoxContainer.new()
	sf_col.add_theme_constant_override("separation", 4)
	ships_row.add_child(sf_col)
	var interceptor_card_id: String = result.get("interceptorCardId", "")
	var interceptor_name: String = result.get("interceptorName", "Starfighter")
	var interceptor_base: int = int(result.get("interceptorPower", 0))
	var sf_label_node := Label.new()
	sf_label_node.text = "Opponent's Starfighter" if is_mine else "Your Starfighter"
	sf_label_node.add_theme_font_size_override("font_size", 11)
	sf_label_node.add_theme_color_override("font_color", Color(1.0, 0.5, 0.4) if is_mine else Color(0.4, 0.7, 1.0))
	sf_label_node.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sf_col.add_child(sf_label_node)
	var sf_tex := TextureRect.new()
	sf_tex.custom_minimum_size = Vector2(110, 154)
	sf_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sf_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	sf_tex.texture = _load_card_texture_for_id(interceptor_card_id, opp_side)
	sf_col.add_child(sf_tex)
	var sf_power_lbl := Label.new()
	sf_power_lbl.text = "Power: %d" % interceptor_base
	sf_power_lbl.add_theme_font_size_override("font_size", 13)
	sf_power_lbl.add_theme_color_override("font_color", Color(1, 1, 1))
	sf_power_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sf_col.add_child(sf_power_lbl)
	# Container for animated steps below the ships
	var steps_container := VBoxContainer.new()
	steps_container.add_theme_constant_override("separation", 6)
	vbox.add_child(steps_container)
	# Dismiss button (hidden until animation finishes)
	var dismiss_btn := Button.new()
	dismiss_btn.text = "OK"
	dismiss_btn.add_theme_font_size_override("font_size", 14)
	dismiss_btn.visible = false
	dismiss_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": {"kind": "dismiss_evacuation_result"}
		})
		if _evacuation_overlay:
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
	)
	vbox.add_child(dismiss_btn)
	# Animated sequence with timers
	var delay: float = 0.0
	var overlay_ref := _evacuation_overlay
	# Step 3: Destiny draw (after 2s)
	if intercepted:
		delay += 2.0
		var dest_draw: Dictionary = result.get("interceptorDestinyDraw", {})
		var dest_card_id: String = str(dest_draw.get("cardId", ""))
		var dest_val: int = int(dest_draw.get("destiny", 0))
		get_tree().create_timer(delay).timeout.connect(func() -> void:
			if not is_instance_valid(overlay_ref) or overlay_ref != _evacuation_overlay:
				return
			var destiny_row := HBoxContainer.new()
			destiny_row.alignment = BoxContainer.ALIGNMENT_CENTER
			destiny_row.add_theme_constant_override("separation", 8)
			steps_container.add_child(destiny_row)
			var draw_lbl := Label.new()
			draw_lbl.text = "Destiny Draw:"
			draw_lbl.add_theme_font_size_override("font_size", 13)
			draw_lbl.add_theme_color_override("font_color", Color(0.9, 0.85, 0.4))
			destiny_row.add_child(draw_lbl)
			if dest_card_id.length() > 0:
				var d_tex := TextureRect.new()
				d_tex.custom_minimum_size = Vector2(54, 76)
				d_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
				d_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
				d_tex.texture = _load_card_texture_for_id(dest_card_id, opp_side)
				d_tex.modulate.a = 0.0
				destiny_row.add_child(d_tex)
				var tw := d_tex.create_tween()
				tw.tween_property(d_tex, "modulate:a", 1.0, 0.4)
			var plus_lbl := Label.new()
			plus_lbl.text = "+%d" % dest_val
			plus_lbl.add_theme_font_size_override("font_size", 16)
			plus_lbl.add_theme_color_override("font_color", Color(1.0, 0.95, 0.5))
			destiny_row.add_child(plus_lbl)
			sf_power_lbl.text = "Power: %d + %d" % [interceptor_base, dest_val]
		)
		# Step 4: Show totals and outcome (after 4s)
		delay += 2.0
		var interceptor_total: int = int(result.get("interceptorTotalPower", 0))
		get_tree().create_timer(delay).timeout.connect(func() -> void:
			if not is_instance_valid(overlay_ref) or overlay_ref != _evacuation_overlay:
				return
			sf_power_lbl.text = "Total: %d" % interceptor_total
			t_power_lbl.text = "Total: %d" % transport_power
			var result_lbl := Label.new()
			if outcome == "success":
				result_lbl.text = "Transport wins! Evacuation successful."
				result_lbl.add_theme_color_override("font_color", Color(0.3, 1.0, 0.4))
			elif outcome == "transport_destroyed":
				result_lbl.text = "Starfighter wins! Transport destroyed!"
				result_lbl.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3))
			else:
				result_lbl.text = "Tie! Both ships survive. Evacuation successful."
				result_lbl.add_theme_color_override("font_color", Color(0.9, 0.85, 0.4))
			result_lbl.add_theme_font_size_override("font_size", 15)
			result_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			result_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			steps_container.add_child(result_lbl)
		)
		# Step 5: Show damage/mill cards (after 6s)
		delay += 2.0
		get_tree().create_timer(delay).timeout.connect(func() -> void:
			if not is_instance_valid(overlay_ref) or overlay_ref != _evacuation_overlay:
				return
			_show_evac_damage_cards(steps_container, result, is_mine, evac_side, opp_side)
			dismiss_btn.visible = true
			_start_evac_result_auto_close_timer(15.0)
		)
	else:
		# Not intercepted but still got here (shouldn't normally, but handle gracefully)
		var result_lbl := Label.new()
		result_lbl.text = "Evacuation successful!"
		result_lbl.add_theme_font_size_override("font_size", 15)
		result_lbl.add_theme_color_override("font_color", Color(0.3, 1.0, 0.4))
		result_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		steps_container.add_child(result_lbl)
		dismiss_btn.visible = true
		_start_evac_result_auto_close_timer(15.0)


func _start_evac_result_auto_close_timer(seconds: float) -> void:
	get_tree().create_timer(seconds).timeout.connect(func() -> void:
		if _evacuation_overlay and is_instance_valid(_evacuation_overlay):
			Connection.get_client().send_message({
				"type": "game_action",
				"action": {"kind": "dismiss_evacuation_result"}
			})
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
			_refresh()
	)


func _show_evac_damage_cards(container: VBoxContainer, result: Dictionary, is_mine: bool, evac_side: String, opp_side: String) -> void:
	var outcome: String = result.get("outcome", "")
	if outcome == "transport_destroyed":
		var discarded: Array = result.get("discardedCardIds", [])
		if discarded.size() > 0:
			var disc_lbl := Label.new()
			disc_lbl.text = "%d card%s on transport discarded:" % [discarded.size(), "s" if discarded.size() > 1 else ""]
			disc_lbl.add_theme_font_size_override("font_size", 12)
			disc_lbl.add_theme_color_override("font_color", Color(1.0, 0.6, 0.5))
			disc_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			container.add_child(disc_lbl)
			var disc_row := HBoxContainer.new()
			disc_row.alignment = BoxContainer.ALIGNMENT_CENTER
			disc_row.add_theme_constant_override("separation", 4)
			container.add_child(disc_row)
			for cid in discarded:
				var tex := TextureRect.new()
				tex.custom_minimum_size = Vector2(44, 62)
				tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
				tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
				tex.texture = _load_card_texture_for_id(str(cid), evac_side)
				tex.modulate.a = 0.0
				disc_row.add_child(tex)
				var tw := tex.create_tween()
				tw.tween_property(tex, "modulate:a", 1.0, 0.3)
		var milled: Array = result.get("transportMilledCardIds", [])
		if milled.size() > 0:
			var mill_lbl := Label.new()
			mill_lbl.text = "%d card%s milled from %s deck (damage):" % [milled.size(), "s" if milled.size() > 1 else "", "your" if is_mine else "opponent's"]
			mill_lbl.add_theme_font_size_override("font_size", 12)
			mill_lbl.add_theme_color_override("font_color", Color(1.0, 0.6, 0.5))
			mill_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			mill_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			container.add_child(mill_lbl)
			var mill_row := HBoxContainer.new()
			mill_row.alignment = BoxContainer.ALIGNMENT_CENTER
			mill_row.add_theme_constant_override("separation", 4)
			container.add_child(mill_row)
			for cid in milled:
				var tex := TextureRect.new()
				tex.custom_minimum_size = Vector2(44, 62)
				tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
				tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
				tex.texture = _load_card_texture_for_id(str(cid), evac_side)
				tex.modulate.a = 0.0
				mill_row.add_child(tex)
				var tw := tex.create_tween()
				tw.tween_property(tex, "modulate:a", 1.0, 0.3)
	elif outcome == "success" or outcome == "tie":
		var evacuated: Array = result.get("evacuatedCardIds", [])
		if evacuated.size() > 0:
			var evac_lbl := Label.new()
			evac_lbl.text = "%d card%s evacuated back to %s deck." % [evacuated.size(), "s" if evacuated.size() > 1 else "", "your" if is_mine else "opponent's"]
			evac_lbl.add_theme_font_size_override("font_size", 12)
			evac_lbl.add_theme_color_override("font_color", Color(0.4, 1.0, 0.6))
			evac_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			evac_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			container.add_child(evac_lbl)
		if result.get("intercepted", false):
			var sf_mill: Array = result.get("interceptorMilledCardIds", [])
			if sf_mill.size() > 0:
				var sf_mill_lbl := Label.new()
				sf_mill_lbl.text = "%d card%s milled from %s deck (Starfighter damage):" % [sf_mill.size(), "s" if sf_mill.size() > 1 else "", "opponent's" if is_mine else "your"]
				sf_mill_lbl.add_theme_font_size_override("font_size", 12)
				sf_mill_lbl.add_theme_color_override("font_color", Color(1.0, 0.6, 0.5))
				sf_mill_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				sf_mill_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				container.add_child(sf_mill_lbl)
				var sf_mill_row := HBoxContainer.new()
				sf_mill_row.alignment = BoxContainer.ALIGNMENT_CENTER
				sf_mill_row.add_theme_constant_override("separation", 4)
				container.add_child(sf_mill_row)
				for cid in sf_mill:
					var tex := TextureRect.new()
					tex.custom_minimum_size = Vector2(44, 62)
					tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
					tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
					tex.texture = _load_card_texture_for_id(str(cid), opp_side)
					tex.modulate.a = 0.0
					sf_mill_row.add_child(tex)
					var tw := tex.create_tween()
					tw.tween_property(tex, "modulate:a", 1.0, 0.3)


func _cancel_discard_popup_hide() -> void:
	if _discard_popup_hide_timer:
		_discard_popup_hide_timer.stop()


func _schedule_discard_popup_hide() -> void:
	if _discard_popup_hide_timer:
		_discard_popup_hide_timer.start()


func _hide_discard_popups() -> void:
	if _discard_popup_yours:
		_discard_popup_yours.visible = false
	if _discard_popup_opp:
		_discard_popup_opp.visible = false


func _on_your_discard_mouse_entered() -> void:
	_cancel_discard_popup_hide()
	if _discard_popup_yours and your_discard_wrapper:
		var tex: TextureRect = _discard_popup_yours.get_meta("card_texture")
		var count_lbl: Label = _discard_popup_yours.get_meta("count_label")
		if tex:
			tex.texture = _your_discard_top_texture if _your_discard_top_texture else your_discard.texture
		if count_lbl:
			count_lbl.text = str(_your_discard_count_cached) + " cards"
		var rect: Rect2 = your_discard_wrapper.get_global_rect()
		var popup_w: float = _discard_popup_yours.custom_minimum_size.x
		var popup_h: float = _discard_popup_yours.custom_minimum_size.y
		var pos: Vector2 = Vector2(rect.position.x + rect.size.x / 2.0 - popup_w / 2.0, rect.position.y - popup_h - 8)
		var vp: Rect2 = get_viewport_rect()
		pos.x = clampf(pos.x, 0, vp.size.x - popup_w)
		pos.y = clampf(pos.y, 0, vp.size.y - popup_h)
		_discard_popup_yours.position = pos
		if _discard_popup_opp:
			_discard_popup_opp.visible = false
		_discard_popup_yours.visible = true


func _on_your_discard_mouse_exited() -> void:
	_schedule_discard_popup_hide()


func _on_opp_discard_mouse_entered() -> void:
	_cancel_discard_popup_hide()
	if _discard_popup_opp and opp_discard_wrapper:
		var tex: TextureRect = _discard_popup_opp.get_meta("card_texture")
		var count_lbl: Label = _discard_popup_opp.get_meta("count_label")
		if tex:
			tex.texture = _opp_discard_top_texture if _opp_discard_top_texture else opp_discard.texture
		if count_lbl:
			count_lbl.text = str(_opp_discard_count_cached) + " cards"
		var rect: Rect2 = opp_discard_wrapper.get_global_rect()
		var popup_w: float = _discard_popup_opp.custom_minimum_size.x
		var popup_h: float = _discard_popup_opp.custom_minimum_size.y
		var pos: Vector2 = Vector2(rect.position.x + rect.size.x / 2.0 - popup_w / 2.0, rect.position.y + rect.size.y + 8)
		var vp: Rect2 = get_viewport_rect()
		pos.x = clampf(pos.x, 0, vp.size.x - popup_w)
		pos.y = clampf(pos.y, 0, vp.size.y - popup_h)
		_discard_popup_opp.position = pos
		if _discard_popup_yours:
			_discard_popup_yours.visible = false
		_discard_popup_opp.visible = true


func _on_opp_discard_mouse_exited() -> void:
	_schedule_discard_popup_hide()


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var e: InputEventMouseButton = event
		if e.button_index == MOUSE_BUTTON_LEFT:
			if e.pressed:
				if not _dragging_instance_id and battle_plan_section and battle_plan_section.visible:
					var pos: Vector2 = get_global_mouse_position()
					# Check your_play_container (cards live here during battle plan)
					var drag_row: Control = null
					var pub_check: Dictionary = Connection.get_state().game_state.get("publicState", {})
					if pub_check.get("battlePlanPhase", false) and your_play_container:
						drag_row = your_play_container
					elif battle_plan_row:
						drag_row = battle_plan_row
					if drag_row:
						for child in drag_row.get_children():
							if child is Control and (child as Control).get_global_rect().has_point(pos):
								if child.has_method("get_card_instance_id"):
									var inst_id: String = child.get_card_instance_id()
									if not inst_id.is_empty():
										_on_battle_plan_drag_started(inst_id)
										get_viewport().set_input_as_handled()
									break
			else:
				if _dragging_from_battle_plan and _dragging_instance_id:
					_on_battle_plan_drag_ended(_dragging_instance_id)
					get_viewport().set_input_as_handled()
				elif not _dragging_instance_id.is_empty():
					_handle_drag_released(_dragging_instance_id, get_global_mouse_position())
					_dragging_instance_id = ""
					_clear_drag_preview()


func _process(_delta: float) -> void:
	Connection.get_client().poll()
	if _dragging_instance_id and _drag_preview:
		_drag_preview.position = get_viewport().get_mouse_position() - _drag_preview.size / 2
	_sync_actions_panel()


var _actions_idle_label: Label = null


func _sync_actions_panel() -> void:
	if actions_right == null:
		return
	if _actions_idle_label == null:
		_actions_idle_label = Label.new()
		_actions_idle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_actions_idle_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		_actions_idle_label.custom_minimum_size = ACTION_BTN_SIZE
		_actions_idle_label.add_theme_font_size_override("font_size", 12)
		_actions_idle_label.add_theme_color_override("font_color", Color(0.62, 0.68, 0.82))
		var idle_style := StyleBoxFlat.new()
		idle_style.bg_color = Color(0.03, 0.05, 0.12, 0.55)
		idle_style.border_color = Color(0.3, 0.42, 0.62, 0.45)
		idle_style.set_border_width_all(1)
		idle_style.set_corner_radius_all(9)
		_actions_idle_label.add_theme_stylebox_override("normal", idle_style)
		if _heading_font == null:
			_heading_font = load("res://fonts/Orbitron.ttf") as Font
		if _heading_font:
			_actions_idle_label.add_theme_font_override("font", _heading_font)
		actions_right.add_child(_actions_idle_label)
		actions_right.move_child(_actions_idle_label, 0)
	var any_button := false
	for c in actions_right.get_children():
		if c is Button and (c as Button).visible:
			any_button = true
			break
	_actions_idle_label.visible = not any_button
	if not any_button:
		var g: Dictionary = Connection.get_state().game_state
		var idle_text: String = "Waiting…"
		if _game_over_received:
			idle_text = "Game over"
		elif str(g.get("turnSide", "")) != Connection.get_state().game_side and str(g.get("phase", "")) in ["draw", "deploy", "battle", "even_up"]:
			idle_text = "Opponent's turn"
		if _actions_idle_label.text != idle_text:
			_actions_idle_label.text = idle_text
	_style_action_button(pass_phase_btn, "secondary" if battle_btn.visible else "primary")


func _on_hand_card_drag_started(instance_id: String) -> void:
	var g: Dictionary = Connection.get_state().game_state
	var phase: String = g.get("phase", "")
	var turn_side: String = g.get("turnSide", "")
	var my_side: String = Connection.get_state().game_side
	var pub: Dictionary = g.get("publicState", {})
	if pub.get("winControlPending") is Dictionary:
		return
	var in_bc_declare: bool = pub.get("battleCardDeclareSide", "") == my_side
	if not _dragging_from_battle_plan and not in_bc_declare and (phase != "deploy" or turn_side != my_side):
		return
	_dragging_instance_id = instance_id
	var card_id: String = ""
	if _dragging_from_battle_plan:
		var my_in_play: Array = pub.get("lightInPlay" if my_side == "light" else "darkInPlay", [])
		for card in my_in_play:
			if card.get("instanceId", "") == instance_id:
				card_id = card.get("cardId", "")
				break
		if card_id.is_empty():
			for entry in Connection.get_state().hand_with_instances:
				if entry.get("instanceId", "") == instance_id:
					card_id = entry.get("cardId", "")
					break
	else:
		for entry in Connection.get_state().hand_with_instances:
			if entry.get("instanceId", "") == instance_id:
				card_id = entry.get("cardId", "")
				break
	var drag_tex: Texture2D = null
	if card_id and CardCatalog:
		var paths_to_try: Array[String] = CardCatalog.get_card_image_paths(card_id, my_side)
		for p in paths_to_try:
			drag_tex = load(p) as Texture2D
			if drag_tex:
				break
	if not drag_tex:
		drag_tex = CARD_BACK_LIGHT if my_side == "light" else CARD_BACK_DARK
	_drag_preview_layer = CanvasLayer.new()
	_drag_preview_layer.layer = 150
	add_child(_drag_preview_layer)
	_drag_preview = TextureRect.new()
	_drag_preview.texture = drag_tex
	_drag_preview.custom_minimum_size = Vector2(96, 136)
	_drag_preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_drag_preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_drag_preview.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_drag_preview_layer.add_child(_drag_preview)
	_drag_preview.position = get_viewport().get_mouse_position() - _drag_preview.custom_minimum_size / 2


func _on_hand_card_drag_ended(instance_id: String) -> void:
	if _dragging_instance_id.is_empty():
		_clear_drag_preview()
		# Drag is not valid in this phase (e.g. Even Up). Treat the release as a click
		# so discard-location / even-up discards still work if the mouse moved a little.
		_on_card_selected(instance_id)
		return
	_handle_drag_released(instance_id, get_global_mouse_position())
	_dragging_instance_id = ""
	_clear_drag_preview()


func _handle_drag_released(instance_id: String, pos: Vector2) -> void:
	if _try_drop_battle_card_declare(instance_id, pos):
		return
	var drop_rect: Rect2 = _get_play_area_drop_rect()
	if drop_rect.has_point(pos):
		_try_deploy_dragged_card()
	else:
		if starting_location_slot and starting_location_slot.get_global_rect().has_point(pos):
			var card_id: String = ""
			for entry in Connection.get_state().hand_with_instances:
				if entry.get("instanceId", "") == instance_id:
					card_id = entry.get("cardId", "")
					break
			if card_id and _can_replace_location_with(card_id):
				_try_deploy_dragged_card()


func _get_play_area_drop_rect() -> Rect2:
	# Use the full game area (Margin) so dragging anywhere on the field plays the card
	var margin_node: Control = get_node_or_null("HBoxContainer/Margin")
	if margin_node:
		return margin_node.get_global_rect()
	if your_play_container:
		return your_play_container.get_global_rect()
	return Rect2()


func _try_drop_battle_card_declare(instance_id: String, pos: Vector2) -> bool:
	var g: Dictionary = Connection.get_state().game_state
	var pub: Dictionary = g.get("publicState", {})
	var declare_side: String = pub.get("battleCardDeclareSide", "")
	var my_side: String = Connection.get_state().game_side
	if declare_side != my_side or declare_side.is_empty():
		return false
	var card_id: String = ""
	for entry in Connection.get_state().hand_with_instances:
		if entry.get("instanceId", "") == instance_id:
			card_id = entry.get("cardId", "")
			break
	if card_id.is_empty():
		return false
	if CardCatalog:
		var info: Dictionary = CardCatalog.get_card_info(card_id, my_side)
		var ctype: String = str(info.get("type", "")).to_lower()
		if ctype != "battle":
			status_label.text = "Only Battle cards can be declared here."
			return true
	var hand_rect: Rect2 = hand_container.get_global_rect() if hand_container else Rect2()
	var on_hand: bool = hand_rect.get_area() > 0 and hand_rect.has_point(pos)
	if on_hand:
		return false
	if _declared_battle_cards.has(instance_id):
		return true
	_declared_battle_cards.append(instance_id)
	_refresh()
	return true


func _clear_drag_preview() -> void:
	if _drag_preview:
		_drag_preview.queue_free()
		_drag_preview = null
	if _drag_preview_layer:
		_drag_preview_layer.queue_free()
		_drag_preview_layer = null


func _try_deploy_dragged_card() -> void:
	if _dragging_instance_id.is_empty():
		return
	var g: Dictionary = Connection.get_state().game_state
	var phase: String = g.get("phase", "")
	var turn_side: String = g.get("turnSide", "")
	var my_side: String = Connection.get_state().game_side
	var pub_drag: Dictionary = g.get("publicState", {})
	var evac_drag: Dictionary = pub_drag.get("evacuationState", {})
	var intercept_window: bool = evac_drag.get("awaitingInterception", false) and str(evac_drag.get("evacuatingSide", "")) != my_side and _uses_hyperspace(pub_drag)
	if phase != "deploy":
		return
	if turn_side != my_side and not intercept_window:
		return
	var ep_drag: Variant = pub_drag.get("effectActivationPending", null)
	if ep_drag is Dictionary and str(ep_drag.get("side", "")) == my_side:
		status_label.text = "Cancel the effect or discard for it before playing other cards."
		return
	var card_id: String = ""
	for entry in Connection.get_state().hand_with_instances:
		if entry.get("instanceId", "") == _dragging_instance_id:
			card_id = entry.get("cardId", "")
			break
	if card_id and CardCatalog:
		var card_type: String = str(CardCatalog.get_card_info(card_id, my_side).get("type", "")).to_lower()
		if card_type == "battle":
			status_label.text = "Battle cards can only be used during battle."
			return
		if card_type == "starship":
			if not _uses_hyperspace(pub_drag):
				status_label.text = "Starships are played via Evacuate (transport) or interception (starfighter)."
				return
			if turn_side != my_side and not intercept_window:
				return
			Connection.get_client().send_message({
				"type": "game_action",
				"action": { "kind": "play_card", "instanceId": _dragging_instance_id }
			})
			_selected_instance_id = ""
			_refresh()
			return
		if intercept_window:
			return
		if card_type == "location":
			if _can_replace_location_with(card_id):
				Connection.get_client().send_message({
					"type": "game_action",
					"action": { "kind": "play_card", "instanceId": _dragging_instance_id }
				})
				_selected_instance_id = ""
				_refresh()
				return
			status_label.text = "Location cards cannot be played during deploy"
			return
	var cost: int = 0
	if card_id and CardCatalog:
		cost = int(CardCatalog.get_card_info(card_id, my_side).get("cost", 0))
	var my_force: int = int((g.get("light", {}) if my_side == "light" else g.get("dark", {})).get("force", 0))
	if my_force < cost:
		status_label.text = "You don't have enough counters to play this card"
		return
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "play_card", "instanceId": _dragging_instance_id }
	})
	_selected_instance_id = ""
	_refresh()


func _on_message(msg: Dictionary) -> void:
	Connection.get_state().apply_message(msg)


func _on_game_state(_payload: Dictionary) -> void:
	var pub: Dictionary = Connection.get_state().game_state.get("publicState", {})
	var seq: Array = pub.get("battleRevealSequence", [])
	if seq.size() > 0 and _battle_reveal_sequence.is_empty():
		# If game-over overlay was already shown (e.g. game_ended arrived first), hide it and show battle first
		if _game_over_layer and is_instance_valid(_game_over_layer):
			_game_over_layer.visible = false
			var p: Dictionary = _last_game_ended_payload
			if p.size() > 0:
				var my_side: String = Connection.get_state().game_side
				var won: bool = (p.get("winner", "") == my_side)
				var reason: String = p.get("reason", "")
				var reason_text: String = "Deck Victory!" if reason == "deck_empty" else ( "Planet Victory!" if reason == "planet_victory" else ( "Opponent Conceded" if reason == "concede" else "" ) )
				_pending_game_over = { "won": won, "reason_text": reason_text }
		var pub_now: Dictionary = Connection.get_state().game_state.get("publicState", {})
		_update_hyperspace_piles(pub_now, Connection.get_state().game_side)
		_start_battle_reveal_animation(seq)
		return
	_refresh()


func _on_hand(_card_ids: Array) -> void:
	_refresh()


func _on_game_ended(payload: Dictionary) -> void:
	_last_game_ended_payload = payload
	var winner: String = payload.get("winner", "")
	var reason: String = payload.get("reason", "")
	var state: RefCounted = Connection.get_state()
	var my_side: String = state.game_side
	var reason_text: String = ""
	if reason == "planet_victory":
		reason_text = "Planet Victory!"
	elif reason == "deck_empty":
		reason_text = "Deck Victory!"
	var won: bool = (winner == my_side)
	if reason == "concede":
		reason_text = "Opponent Conceded" if won else "You Conceded"
	_game_over_received = true
	_close_concede_modal()
	if location_choice_section:
		location_choice_section.visible = false
	if destiny_compare_section:
		destiny_compare_section.visible = false
	status_label.text = ("You Won!" if won else "You Lost!") + (" " + reason_text if reason_text else "")
	if return_to_lobby_btn:
		return_to_lobby_btn.visible = true
	if concede_btn:
		concede_btn.visible = false
	# Only defer overlay if we're actually in the middle of the battle reveal animation.
	# Otherwise always show the large notification (planet victory, etc.).
	if _battle_reveal_sequence.size() > 0:
		_pending_game_over = { "won": won, "reason_text": reason_text }
		return
	_show_game_over_overlay(won, reason_text)


func _show_game_over_overlay(won: bool, reason_text: String) -> void:
	if _game_over_layer and is_instance_valid(_game_over_layer):
		_game_over_layer.queue_free()
	_clear_dotf_overlay()
	status_label.text = ""
	if return_to_lobby_btn:
		return_to_lobby_btn.visible = false
	var accent: Color = Color(0.86, 0.72, 0.32) if won else Color(0.85, 0.3, 0.28)
	var m := _make_modal(250, accent, 480)
	_game_over_layer = m["layer"]
	var bg: ColorRect = m["bg"]
	bg.color = Color(0.0, 0.01, 0.04, 0.86)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var panel: PanelContainer = m["panel"]
	var vbox: VBoxContainer = m["vbox"]
	var caption := Label.new()
	caption.text = "GAME OVER"
	caption.theme_type_variation = &"HeaderLabel"
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.add_theme_font_size_override("font_size", 13)
	caption.add_theme_color_override("font_color", Color(0.62, 0.68, 0.82))
	vbox.add_child(caption)
	var main_label := Label.new()
	main_label.text = "VICTORY" if won else "DEFEAT"
	main_label.theme_type_variation = &"TitleLabel"
	main_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	main_label.add_theme_font_size_override("font_size", 52)
	main_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.3) if won else Color(0.95, 0.34, 0.3))
	main_label.modulate = Color(1, 1, 1, 0)
	vbox.add_child(main_label)
	var divider := ColorRect.new()
	divider.custom_minimum_size = Vector2(220, 2)
	divider.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	divider.color = Color(accent.r, accent.g, accent.b, 0.6)
	vbox.add_child(divider)
	var reason_label := Label.new()
	reason_label.text = reason_text.trim_suffix("!") if reason_text else ("You won the game" if won else "You lost the game")
	reason_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	reason_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	reason_label.add_theme_font_size_override("font_size", 18)
	reason_label.add_theme_color_override("font_color", Color(0.9, 0.92, 1.0))
	vbox.add_child(reason_label)
	var state: RefCounted = Connection.get_state()
	var my_side: String = state.game_side
	var pub: Dictionary = state.game_state.get("publicState", {}) if state.game_state is Dictionary else {}
	var light_won: int = int(pub.get("lightPlanetsWon", 0))
	var dark_won: int = int(pub.get("darkPlanetsWon", 0))
	var my_planets: int = light_won if my_side == "light" else dark_won
	var opp_planets: int = dark_won if my_side == "light" else light_won
	var opp_side: String = "dark" if my_side == "light" else "light"
	var score := HBoxContainer.new()
	score.alignment = BoxContainer.ALIGNMENT_CENTER
	score.add_theme_constant_override("separation", 12)
	vbox.add_child(score)
	for entry in [["YOU", my_side, my_planets], ["OPPONENT", opp_side, opp_planets]]:
		var chip := PanelContainer.new()
		var col: Color = SIDE_COLOR_LIGHT if str(entry[1]) == "light" else SIDE_COLOR_DARK
		var cs := StyleBoxFlat.new()
		cs.bg_color = Color(col.r * 0.12, col.g * 0.12, col.b * 0.12 + 0.06, 0.9)
		cs.border_color = Color(col.r, col.g, col.b, 0.6)
		cs.set_border_width_all(1)
		cs.set_corner_radius_all(8)
		cs.content_margin_left = 16
		cs.content_margin_right = 16
		cs.content_margin_top = 6
		cs.content_margin_bottom = 6
		chip.add_theme_stylebox_override("panel", cs)
		var chip_row := HBoxContainer.new()
		chip_row.add_theme_constant_override("separation", 10)
		chip.add_child(chip_row)
		var who := Label.new()
		who.text = str(entry[0])
		who.theme_type_variation = &"HeaderLabel"
		who.add_theme_font_size_override("font_size", 12)
		who.add_theme_color_override("font_color", col.lightened(0.3))
		chip_row.add_child(who)
		var n := Label.new()
		n.text = "%d planet%s" % [int(entry[2]), "" if int(entry[2]) == 1 else "s"]
		n.add_theme_font_size_override("font_size", 15)
		n.add_theme_color_override("font_color", Color(0.93, 0.95, 1.0))
		chip_row.add_child(n)
		score.add_child(chip)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 6)
	vbox.add_child(spacer)
	var lobby_btn := Button.new()
	lobby_btn.text = "Return to Lobby"
	_style_action_button(lobby_btn, "primary")
	lobby_btn.custom_minimum_size = Vector2(230, 46)
	lobby_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	lobby_btn.pressed.connect(_on_return_to_lobby_pressed)
	vbox.add_child(lobby_btn)
	panel.pivot_offset = Vector2(240, 150)
	panel.scale = Vector2(0.85, 0.85)
	var pop := create_tween()
	pop.set_ease(Tween.EASE_OUT)
	pop.set_trans(Tween.TRANS_BACK)
	pop.tween_property(panel, "scale", Vector2.ONE, 0.45)
	var tween := create_tween()
	tween.set_ease(Tween.EASE_OUT)
	tween.tween_property(main_label, "modulate:a", 1.0, 0.5)


func _phase_display_name(phase: String) -> String:
	if phase == "draw":
		return "Draw"
	if phase == "deploy":
		return "Deploy"
	if phase == "even_up":
		return "Even Up"
	if phase == "battle":
		return "Battle"
	if phase == "choose_next_planet":
		return "Choose Next Planet"
	return phase.capitalize()


func _go_to_lobby() -> void:
	if is_instance_valid(get_tree()):
		get_tree().change_scene_to_file("res://scenes/main.tscn")


func _on_error(msg: String) -> void:
	status_label.text = "Error: %s" % msg


func _on_game_chat(from: String, text: String, _at: int) -> void:
	_append_chat_line(from, text)


var _chat_unread: int = 0
var _toast_layer: CanvasLayer = null
var _toast_box: VBoxContainer = null


func _on_chat_toggled(open: bool) -> void:
	if chat_panel:
		chat_panel.visible = open
	if open:
		_chat_unread = 0
		if chat_scroll:
			call_deferred("_scroll_chat_to_bottom", chat_scroll)
		if chat_input:
			chat_input.call_deferred("grab_focus")
	_update_chat_toggle_text()
	call_deferred("_fit_board_to_window")


func _update_chat_toggle_text() -> void:
	if chat_toggle_btn == null:
		return
	var show_badge: bool = _chat_unread > 0 and not chat_toggle_btn.button_pressed
	chat_toggle_btn.text = "Hide Chat" if chat_toggle_btn.button_pressed else "Chat"
	if _chat_badge:
		_chat_badge.visible = show_badge
		_chat_badge_label.text = "9+" if _chat_unread > 9 else str(_chat_unread)
	if show_badge:
		chat_toggle_btn.add_theme_color_override("font_color", Color(1.0, 0.86, 0.42))
		chat_toggle_btn.add_theme_color_override("font_hover_color", Color(1.0, 0.9, 0.55))
	else:
		chat_toggle_btn.remove_theme_color_override("font_color")
		chat_toggle_btn.remove_theme_color_override("font_hover_color")


func _show_toast(text: String) -> void:
	if _toast_layer == null:
		_toast_layer = CanvasLayer.new()
		_toast_layer.layer = 60
		add_child(_toast_layer)
		var anchor := Control.new()
		anchor.set_anchors_preset(Control.PRESET_FULL_RECT)
		anchor.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_toast_layer.add_child(anchor)
		_toast_box = VBoxContainer.new()
		_toast_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_toast_box.add_theme_constant_override("separation", 6)
		_toast_box.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		_toast_box.grow_horizontal = Control.GROW_DIRECTION_BEGIN
		_toast_box.offset_top = 58
		_toast_box.offset_right = -16
		_toast_box.alignment = BoxContainer.ALIGNMENT_BEGIN
		anchor.add_child(_toast_box)
	while _toast_box.get_child_count() >= 3:
		var oldest: Node = _toast_box.get_child(0)
		_toast_box.remove_child(oldest)
		oldest.queue_free()
	var panel := PanelContainer.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.size_flags_horizontal = Control.SIZE_SHRINK_END
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.12, 0.92)
	style.set_border_width_all(1)
	style.border_color = Color(0.86, 0.72, 0.32, 0.6)
	style.set_corner_radius_all(8)
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	panel.add_theme_stylebox_override("panel", style)
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", Color(0.96, 0.9, 0.7))
	if text.length() > 44:
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size.x = 300
	panel.add_child(label)
	_toast_box.add_child(panel)
	var tw := panel.create_tween()
	tw.tween_interval(3.5)
	tw.tween_property(panel, "modulate:a", 0.0, 0.5)
	tw.tween_callback(panel.queue_free)


func _append_chat_line(from: String, text: String) -> void:
	if chat_panel and not chat_panel.visible:
		_chat_unread += 1
		_update_chat_toggle_text()
		if from == "System":
			_show_toast(text)
	var line: Label = Label.new()
	line.text = "%s: %s" % [from, text]
	line.add_theme_font_size_override("font_size", 13)
	line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if from == "System":
		line.add_theme_color_override("font_color", Color(0.85, 0.78, 0.5, 1))
	_fit_chat_line_width(line)
	chat_messages.add_child(line)
	if chat_scroll:
		call_deferred("_scroll_chat_to_bottom", chat_scroll)


func _chat_wrap_width() -> float:
	if chat_scroll == null:
		return 180.0
	var w: float = chat_scroll.size.x
	if w < 80.0:
		w = 180.0
	return w


func _fit_chat_line_width(line: Label) -> void:
	line.custom_minimum_size.x = _chat_wrap_width()


func _refit_chat_lines() -> void:
	if chat_messages == null:
		return
	var w: float = _chat_wrap_width()
	for child in chat_messages.get_children():
		if child is Label:
			(child as Label).custom_minimum_size.x = w


func _on_chat_send() -> void:
	_send_chat_text(chat_input.text)


func _on_chat_submitted(new_text: String) -> void:
	_send_chat_text(new_text)


func _on_chat_input_gui_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	if event.keycode != KEY_ENTER and event.keycode != KEY_KP_ENTER:
		return
	_send_chat_text(chat_input.text)
	chat_input.accept_event()


func _scroll_chat_to_bottom(scroll: ScrollContainer) -> void:
	if is_instance_valid(scroll):
		scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value)


func _send_chat_text(text: String) -> void:
	var t: String = text.strip_edges()
	if t.is_empty():
		return
	var frame: int = Engine.get_process_frames()
	if frame == _chat_send_frame:
		return
	_chat_send_frame = frame
	Connection.get_client().game_chat(t)
	if chat_input:
		chat_input.clear()
		chat_input.grab_focus()


func _refresh() -> void:
	var state: RefCounted = Connection.get_state()
	var g: Dictionary = state.game_state
	var phase: String = g.get("phase", "?")
	var turn_side: String = g.get("turnSide", "?")
	var light: Dictionary = g.get("light", {})
	var dark: Dictionary = g.get("dark", {})
	var my_side: String = state.game_side
	var pub: Dictionary = g.get("publicState", {})
	# Deck and discard card backs: your side in front of you (bottom), opponent's side at top
	var your_back = CARD_BACK_LIGHT if my_side == "light" else CARD_BACK_DARK
	var opp_back = CARD_BACK_DARK if my_side == "light" else CARD_BACK_LIGHT
	if your_deck:
		your_deck.texture = your_back
		your_deck.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	if opp_deck:
		opp_deck.texture = opp_back
		opp_deck.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	var my_discard_count: int = (light if my_side == "light" else dark).get("discardCount", 0)
	var opp_discard_count: int = (dark if my_side == "light" else light).get("discardCount", 0)
	var my_top_discard_id: String = (light if my_side == "light" else dark).get("topDiscardCardId", "")
	var opp_top_discard_id: String = (dark if my_side == "light" else light).get("topDiscardCardId", "")
	# Discard piles: face up — show top card image when we have topDiscardCardId; else card back; empty when 0
	_your_discard_count_cached = my_discard_count
	_opp_discard_count_cached = opp_discard_count
	if your_discard:
		if my_discard_count == 0:
			your_discard.texture = null
			_your_discard_top_texture = null
		elif my_top_discard_id and CardCatalog:
			var paths_to_try: Array[String] = CardCatalog.get_card_image_paths(my_top_discard_id, my_side)
			var tex: Texture2D = null
			for p in paths_to_try:
				tex = load(p) as Texture2D
				if tex:
					break
			your_discard.texture = tex if tex else your_back
			_your_discard_top_texture = tex
		else:
			your_discard.texture = your_back
			_your_discard_top_texture = null
	if opp_discard:
		if opp_discard_count == 0:
			opp_discard.texture = null
			_opp_discard_top_texture = null
		elif opp_top_discard_id and CardCatalog:
			var opp_side: String = "dark" if my_side == "light" else "light"
			var paths_to_try: Array[String] = CardCatalog.get_card_image_paths(opp_top_discard_id, opp_side)
			var tex: Texture2D = null
			for p in paths_to_try:
				tex = load(p) as Texture2D
				if tex:
					break
			opp_discard.texture = tex if tex else opp_back
			_opp_discard_top_texture = tex
		else:
			opp_discard.texture = opp_back
			_opp_discard_top_texture = null
	if your_discard_label:
		your_discard_label.text = "Discard %s" % my_discard_count
	if opp_discard_label:
		opp_discard_label.text = "Discard %s" % opp_discard_count
	var light_planets_won: int = int(pub.get("lightPlanetsWon", 0))
	var dark_planets_won: int = int(pub.get("darkPlanetsWon", 0))
	var whose_turn: String = "Your turn" if turn_side == my_side else "Opponent's turn"
	if phase == "determine_first":
		phase_label.text = "SETUP   ·   Drawing destiny to see who goes first"
	elif phase == "choose_starting_location":
		phase_label.text = "SETUP   ·   " + ("You go first" if turn_side == my_side else "Opponent goes first")
	elif phase == "choose_next_planet":
		phase_label.text = "PLANET WON   ·   Choose the next planet"
	else:
		var display_phase: String = _phase_display_name(phase).to_upper()
		if pub.get("duelState") is Dictionary:
			display_phase = "DUEL"
		phase_label.text = "%s   ·   %s" % [display_phase, whose_turn]
	# Deck counts for hover display (deck count text at top removed)
	_your_deck_count = int((light if my_side == "light" else dark).get("deckCount", 0))
	_opp_deck_count = int((dark if my_side == "light" else light).get("deckCount", 0))
	if your_deck_label:
		your_deck_label.text = "Deck %d" % _your_deck_count
	if opp_deck_label:
		opp_deck_label.text = "Deck %d" % _opp_deck_count
	var opp_side_key: String = "dark" if my_side == "light" else "light"
	var my_info: Dictionary = light if my_side == "light" else dark
	var opp_info: Dictionary = dark if my_side == "light" else light
	var in_play_phase: bool = phase != "determine_first" and phase != "choose_starting_location"
	var my_planets: int = light_planets_won if my_side == "light" else dark_planets_won
	var opp_planets: int = dark_planets_won if my_side == "light" else light_planets_won
	_update_info_plate("you", str(my_info.get("name", "You")), my_side, my_info, my_planets, in_play_phase and turn_side == my_side, phase == "deploy")
	_update_info_plate("opp", str(opp_info.get("name", "Opponent")), opp_side_key, opp_info, opp_planets, in_play_phase and turn_side == opp_side_key, phase == "deploy")
	_maybe_announce_turn(phase, turn_side, my_side, in_play_phase)
	# Opponent hand: show N card backs at top center
	if opponent_hand_container:
		var opp_hand_count: int = int(dark.get("handCount", 0)) if my_side == "light" else int(light.get("handCount", 0))
		if opponent_hand_container.get_child_count() != opp_hand_count:
			for c in opponent_hand_container.get_children():
				c.queue_free()
			for i in range(opp_hand_count):
				var tr: TextureRect = TextureRect.new()
				tr.custom_minimum_size = Vector2(44, 62)
				tr.texture = opp_back
				tr.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
				tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
				tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
				opponent_hand_container.add_child(tr)
	var is_my_turn: bool = (turn_side == my_side)
	# Only show buttons relevant to the current phase (same location; no extra buttons)
	if phase != "even_up":
		_discard_location_mode = false
	# Deploy by dragging only; no Play Card button
	play_card_btn.visible = false
	var battle_active: bool = pub.get("battlePlanPhase", false) or pub.get("battleCardDeclareSide", "") != ""
	var evac_in_progress: bool = pub.get("evacuationState", {}).size() > 0
	pass_phase_btn.visible = is_my_turn and not evac_in_progress and (phase == "deploy" or (phase == "battle" and not battle_active)) and not (pub.get("planetEffectFetch") is Dictionary) and not (pub.get("deployFromDeckPending") is Dictionary) and not (pub.get("winControlPending") is Dictionary) and not (pub.get("duelState") is Dictionary) and not (pub.get("destinySwapPending") is Dictionary) and not (pub.get("damageReplacePending") is Dictionary) and not (pub.get("effectActivationPending") is Dictionary) and not (pub.get("jediTrainingPending") is Dictionary) and not (pub.get("poundedPending") is Dictionary) and not (pub.get("deployDrawPending") is Dictionary)
	var any_face_down: bool = false
	for card in pub.get("lightInPlay", []):
		if card.get("faceDown", false):
			any_face_down = true
			break
	if not any_face_down:
		for card in pub.get("darkInPlay", []):
			if card.get("faceDown", false):
				any_face_down = true
				break
	var declare_side: String = pub.get("battleCardDeclareSide", "")
	var starship_battle: bool = bool(pub.get("starshipBattlePhase", false))
	var in_declare_phase: bool = (declare_side != "") and ((phase == "battle") or starship_battle)
	battle_btn.visible = is_my_turn and phase == "battle" and not any_face_down and not pub.get("battlePlanPhase", false) and not in_declare_phase and not (pub.get("duelState") is Dictionary)
	if duel_btn:
		duel_btn.visible = is_my_turn and phase == "battle" and _uses_hyperspace(pub) and not bool(pub.get("duelUsedThisTurn", false)) and not (pub.get("duelState") is Dictionary) and not pub.get("battlePlanPhase", false) and not in_declare_phase and not any_face_down
	if battle_plan_section:
		var in_battle_plan: bool = pub.get("battlePlanPhase", false) and ((phase == "battle") or starship_battle)
		battle_plan_section.visible = in_battle_plan or in_declare_phase
		if in_declare_phase:
			_build_battle_card_declare_ui(state, pub, declare_side)
			if battle_plan_ready_btn:
				battle_plan_ready_btn.visible = false
			if battle_plan_row:
				for c in battle_plan_row.get_children():
					c.queue_free()
		elif in_battle_plan:
			var old_declare_ui: Node = battle_plan_section.get_node_or_null("BattleCardDeclareUI")
			if old_declare_ui:
				battle_plan_section.remove_child(old_declare_ui)
				old_declare_ui.queue_free()
			_battle_cards_in_plan = _declared_battle_cards.duplicate()
			_build_battle_plan_row(state, pub)
			if battle_plan_label:
				battle_plan_label.visible = true
				battle_plan_label.text = "Battle Plan — drag your cards left or right on the table to set the order (left battles first)"
			var my_ready: bool = pub.get("lightBattlePlanReady", false) if my_side == "light" else pub.get("darkBattlePlanReady", false)
			var opp_ready: bool = pub.get("darkBattlePlanReady", false) if my_side == "light" else pub.get("lightBattlePlanReady", false)
			if battle_plan_ready_btn:
				battle_plan_ready_btn.visible = not my_ready
				# disabled state set after _build_in_play so _battle_plan_order is populated
			if battle_plan_row and my_ready and opp_ready:
				status_label.text = "Both ready — resolving battle..."
			elif my_ready:
				status_label.text = "Waiting for opponent to set battle plan..."
			else:
				var bc_count: int = _battle_cards_in_plan.size()
				if bc_count > 0:
					status_label.text = "%d Battle card%s added to your plan." % [bc_count, "s" if bc_count > 1 else ""]
				else:
					status_label.text = ""
		else:
			var old_declare_ui2: Node = battle_plan_section.get_node_or_null("BattleCardDeclareUI")
			if old_declare_ui2:
				battle_plan_section.remove_child(old_declare_ui2)
				old_declare_ui2.queue_free()
			_battle_plan_order.clear()
			_battle_cards_in_plan.clear()
			_declared_battle_cards.clear()
	if _game_over_received:
		discard_hand_btn.visible = false
		even_up_btn.visible = false
		discard_location_btn.visible = false
		pass_phase_btn.visible = false
		battle_btn.visible = false
		if duel_btn:
			duel_btn.visible = false
		if battle_plan_section:
			battle_plan_section.visible = false
	else:
		discard_hand_btn.visible = is_my_turn and phase == "even_up"
		even_up_btn.visible = is_my_turn and phase == "even_up"
		discard_location_btn.visible = is_my_turn and phase == "even_up"
		if discard_location_btn:
			discard_location_btn.text = "Cancel Discard" if _discard_location_mode else "Discard Location"
	if surrender_planet_btn:
		if _game_over_received:
			surrender_planet_btn.visible = false
		else:
			var has_location: bool = pub.get("startingLocationInstanceId", "").length() > 0
			var surrender_pending: String = pub.get("surrenderPending", "")
			if surrender_pending == my_side:
				surrender_planet_btn.visible = is_my_turn and phase == "even_up"
				surrender_planet_btn.text = "Cancel Surrender"
			else:
				surrender_planet_btn.visible = is_my_turn and phase == "even_up" and has_location
				surrender_planet_btn.text = "Surrender Planet"
	concede_btn.visible = not _game_over_received
	if _effect_decline_btn != null and is_instance_valid(_effect_decline_btn):
		_effect_decline_btn.visible = false
	if phase == "even_up" and is_my_turn:
		var my_hand_count: int = int((light if my_side == "light" else dark).get("handCount", 0))
		var surrender_pending_status: String = pub.get("surrenderPending", "")
		if _discard_location_mode:
			status_label.text = "Click a location card to discard it."
		elif my_hand_count > 6:
			status_label.text = "You must discard down to 6. Click a card to discard."
		elif surrender_pending_status == my_side:
			status_label.text = "Surrendering planet after Even Up."
		else:
			status_label.text = ""
	elif phase == "deploy" and turn_side == my_side:
		_ensure_effect_decline_btn()
		var ep2: Variant = pub.get("effectActivationPending", null)
		if ep2 is Dictionary and str(ep2.get("side", "")) == my_side and str(ep2.get("kind", "")) != "peek_opp_deck" and str(ep2.get("kind", "")) != "bottom_hand":
			if _effect_decline_btn:
				_effect_decline_btn.visible = true
			var eff_nm: String = str(ep2.get("effectCardName", "Effect"))
			var add_ct: int = int(ep2.get("countersToAdd", 0))
			status_label.text = "%s — click a card in your hand to discard and gain +%d counters (or Cancel effect)." % [eff_nm, add_ct]
		else:
			if _effect_decline_btn:
				_effect_decline_btn.visible = false
	# Destiny compare (who goes first): show two cards in the middle until phase changes
	var destiny_compare: Dictionary = pub.get("destinyCompare", {})
	if phase == "determine_first" and destiny_compare.size() > 0:
		destiny_compare_section.visible = true
		var rounds: Array = destiny_compare.get("rounds", [])
		if rounds.is_empty():
			var light_data: Dictionary = destiny_compare.get("light", {})
			var dark_data: Dictionary = destiny_compare.get("dark", {})
			if light_data.size() > 0 or dark_data.size() > 0:
				rounds = [{"light": light_data, "dark": dark_data}]
		var label_parts: PackedStringArray = []
		for i in range(rounds.size()):
			var r: Dictionary = rounds[i]
			var l: Dictionary = r.get("light", {})
			var d: Dictionary = r.get("dark", {})
			label_parts.append("[color=#%s][b]Light %d[/b][/color]   vs   [color=#%s][b]Dark %d[/b][/color]" % [SIDE_COLOR_LIGHT.to_html(false), int(l.get("destiny", 0)), SIDE_COLOR_DARK.to_html(false), int(d.get("destiny", 0))])
		destiny_compare_label.text = "     |     ".join(label_parts) + "   —   Higher goes first"
		_color_destiny_captions(my_side)
		if not _destiny_flying:
			for c in opponent_destiny_slot.get_children():
				c.queue_free()
			for c in your_destiny_slot.get_children():
				c.queue_free()
		var opp_side: String = "dark" if my_side == "light" else "light"
		var first_opp_id: String = ""
		var first_your_id: String = ""
		if rounds.size() > 0:
			var r0: Dictionary = rounds[0]
			var l0: Dictionary = r0.get("light", {})
			var d0: Dictionary = r0.get("dark", {})
			first_opp_id = d0.get("cardId", "") if my_side == "light" else l0.get("cardId", "")
			first_your_id = l0.get("cardId", "") if my_side == "light" else d0.get("cardId", "")
		var do_animate: bool = not _destiny_animation_done and rounds.size() == 1 and (first_opp_id or first_your_id)
		if do_animate:
			_destiny_animation_done = true
			_animate_destiny_cards_from_decks(first_opp_id, first_your_id, opp_side)
		elif not _destiny_flying:
			for i in range(rounds.size()):
				var r: Dictionary = rounds[i]
				var l: Dictionary = r.get("light", {})
				var d: Dictionary = r.get("dark", {})
				var opp_card_id: String = (d.get("cardId", "") if my_side == "light" else l.get("cardId", ""))
				var your_card_id: String = (l.get("cardId", "") if my_side == "light" else d.get("cardId", ""))
				if opp_card_id:
					var cp_opp: Control = CardPlaceholderScene.instantiate()
					opponent_destiny_slot.add_child(cp_opp)
					cp_opp.set_card(opp_card_id, "", opp_side)
				if your_card_id:
					var cp_yours: Control = CardPlaceholderScene.instantiate()
					your_destiny_slot.add_child(cp_yours)
					cp_yours.set_card(your_card_id, "", my_side)
	else:
		destiny_compare_section.visible = false
		_destiny_animation_done = false
	# Initial draw animation: wait a moment so player sees it, then animate from deck to hand
	# Initial draw animation when first entering deploy after choosing location (we now skip draw phase)
	if (phase == "draw" or phase == "deploy") and _previous_phase == "choose_starting_location" and not _initial_draw_animation_done:
		var hand_entries: Array = state.hand_with_instances
		if hand_entries.size() >= 6:
			_initial_draw_animation_done = true
			var tree: SceneTree = get_tree()
			var delay: SceneTreeTimer = tree.create_timer(2.8)
			delay.timeout.connect(func() -> void: _animate_initial_draw(state, hand_entries))
			_previous_phase = phase
			# Skip normal _build_hand; animation will call it when done. Still build rest.
			_build_in_play(state)
			play_card_btn.text = "Play Card"
			_update_hyperspace_piles(pub, my_side)
			_update_dotf_choice_ui(state, pub, my_side)
			return
	if phase != "draw":
		_initial_draw_animation_done = false
	# Hand label hidden (per request); only show choose-location hint when in that phase
	if hand_label:
		hand_label.visible = false
	if _game_over_received:
		location_choice_section.visible = false
	elif phase == "choose_starting_location" or phase == "choose_next_planet":
		location_choice_section.visible = true
		var starting_pick: bool = phase == "choose_starting_location"
		var my_pick: bool = turn_side == my_side
		if location_choice_label:
			if my_pick:
				location_choice_label.text = "Choose your starting location" if starting_pick else "Choose the next planet"
			else:
				location_choice_label.text = "Opponent is choosing the starting location" if starting_pick else "Opponent is choosing the next planet"
		if location_choice_hint:
			location_choice_hint.text = "Click a location to play it." if my_pick else "Waiting for their pick…"
	else:
		location_choice_section.visible = false
	# Starting location card centered in table (planet name above it); table cards below
	var starting_inst_id: String = pub.get("startingLocationInstanceId", "")
	if starting_inst_id:
		location_row.visible = true
		_build_starting_location_card(state, starting_inst_id, pub)
	else:
		location_row.visible = false
		for c in starting_location_slot.get_children():
			c.queue_free()
	# Hand: show cards for play, or location choices when choosing starting location
	_build_hand(state)
	# In-play areas
	_build_in_play(state)
	# Battle plan ready button: enable only after _build_in_play has populated _battle_plan_order
	if pub.get("battlePlanPhase", false) and battle_plan_ready_btn and battle_plan_ready_btn.visible:
		battle_plan_ready_btn.disabled = _battle_plan_order.is_empty()
	play_card_btn.text = "Play Card"
	_update_controlled_planets_display(pub)
	_update_hyperspace_piles(pub, my_side)
	_update_evacuation_ui(state, pub, phase, my_side)
	_update_dotf_choice_ui(state, pub, my_side)
	_fit_board_to_window()
	_previous_phase = phase


func _play_blocked(pub: Dictionary) -> bool:
	if pub.get("planetEffectFetch") is Dictionary:
		return true
	if pub.get("deployFromDeckPending") is Dictionary:
		return true
	if pub.get("winControlPending") is Dictionary:
		return true
	if pub.get("duelState") is Dictionary:
		return true
	if pub.get("effectActivationPending") is Dictionary:
		return true
	if pub.get("jediTrainingPending") is Dictionary:
		return true
	if pub.get("damageReplacePending") is Dictionary:
		return true
	if pub.get("poundedPending") is Dictionary:
		return true
	if pub.get("deployDrawPending") is Dictionary:
		return true
	if pub.get("destinySwapPending") is Dictionary:
		return true
	if bool(pub.get("starshipBattlePhase", false)):
		return true
	if pub.get("evacuationState") is Dictionary:
		return true
	return false


func _printed_deploy_cost(info: Dictionary, card_id: String, pub: Dictionary, my_side: String) -> int:
	var card_type := str(info.get("type", "")).to_lower()
	if card_type == "starship":
		return 0
	var base := int(info.get("cost", 0))
	if card_type == "character":
		var bonus := str(info.get("gametextbonus", ""))
		var mine: Array = pub.get("lightInPlay" if my_side == "light" else "darkInPlay", [])
		var theirs: Array = pub.get("darkInPlay" if my_side == "light" else "lightInPlay", [])
		for clause in bonus.split(";"):
			var parts: PackedStringArray = clause.split(",")
			if parts.size() < 3:
				continue
			if parts[1].strip_edges().to_lower() != "cost":
				continue
			var cond := parts[2].strip_edges().to_lower()
			if cond.is_empty():
				continue
			for c in mine + theirs:
				if str(c.get("cardId", "")).to_lower().contains(cond):
					return int(parts[0].strip_edges())
		return base
	if card_type == "weapon" and base > 0 and CardCatalog:
		var id := card_id.to_lower()
		var name := str(info.get("name", "")).to_lower().replace(" ", "")
		var mine: Array = pub.get("lightInPlay" if my_side == "light" else "darkInPlay", [])
		for c in mine:
			if bool(c.get("faceDown", false)):
				continue
			var einfo: Dictionary = CardCatalog.get_card_info(str(c.get("cardId", "")), my_side, str(c.get("set", "")))
			var effects := str(einfo.get("effects", "")).to_lower()
			var marker := "deployfree:"
			var at := effects.find(marker)
			if at < 0:
				continue
			var token := effects.substr(at + marker.length())
			var cut := token.find(",")
			if cut >= 0:
				token = token.substr(0, cut)
			token = token.strip_edges()
			if not token.is_empty() and (id.contains(token) or name.contains(token)):
				return 0
	return base


func _have_effect_at_location(pub: Dictionary, my_side: String) -> bool:
	if not CardCatalog:
		return false
	var mine: Array = pub.get("lightInPlay" if my_side == "light" else "darkInPlay", [])
	var loc_id := str(pub.get("startingLocationInstanceId", ""))
	for c in mine:
		if str(c.get("instanceId", "")) == loc_id:
			continue
		var info: Dictionary = CardCatalog.get_card_info(str(c.get("cardId", "")), my_side, str(c.get("set", "")))
		if str(info.get("type", "")).to_lower() == "effect":
			return true
	return false


func _hand_battle_card_ready(card_id: String, card_set: String, my_side: String, pub: Dictionary) -> bool:
	if str(pub.get("battleCardDeclareSide", "")) != my_side or _play_blocked(pub) or not CardCatalog or card_id.is_empty():
		return false
	var info: Dictionary = CardCatalog.get_card_info(card_id, my_side, card_set)
	return str(info.get("type", "")).to_lower() == "battle"


func _hand_card_can_deploy(card_id: String, card_set: String, my_side: String, pub: Dictionary, phase: String, turn_side: String) -> bool:
	if phase != "deploy" or turn_side != my_side or _play_blocked(pub):
		return false
	if not CardCatalog or card_id.is_empty():
		return false
	var info: Dictionary = CardCatalog.get_card_info(card_id, my_side, card_set)
	var card_type := str(info.get("type", "")).to_lower()
	if card_type == "location":
		return _can_replace_location_with(card_id)
	if card_type != "character" and card_type != "weapon" and card_type != "effect" and card_type != "starship":
		return false
	var side_name := str(info.get("side", ""))
	if side_name != "" and side_name != my_side:
		return false
	if card_type == "effect" and _have_effect_at_location(pub, my_side):
		return false
	return _side_force(my_side) >= _printed_deploy_cost(info, card_id, pub, my_side)


func _table_ability_glow(card: Dictionary, pub: Dictionary, my_side: String, phase: String, turn_side: String) -> String:
	if turn_side != my_side or _play_blocked(pub) or bool(card.get("faceDown", false)) or not CardCatalog:
		return ""
	var card_id := str(card.get("cardId", ""))
	var info: Dictionary = CardCatalog.get_card_info(card_id, my_side, str(card.get("set", "")))
	var card_type := str(info.get("type", "")).to_lower()
	var used: Array = pub.get("usedEffectsThisTurn", [])
	if used.has(str(card.get("instanceId", ""))):
		return ""
	var effects := str(info.get("effects", "")).to_lower()
	var bonus := _card_bonus_text(card_id)
	if phase == "deploy":
		if card_type == "effect":
			if effects.contains("bottomhand:"):
				var hand_n := 0
				if Connection.get_state():
					hand_n = Connection.get_state().hand_with_instances.size()
				if hand_n > 0:
					return "ability"
			elif effects.contains("peekopp:top"):
				var opp_key := "dark" if my_side == "light" else "light"
				var opp_view: Dictionary = {}
				if Connection.get_state():
					opp_view = Connection.get_state().game_state.get(opp_key, {})
				if int(opp_view.get("deckCount", 0)) > 0:
					return "ability"
			elif effects.contains("yourdeploydiscard:counters+"):
				return "ability"
		if bonus.contains("discardsearcher"):
			return "ability"
	if phase == "even_up" and card_type == "effect" and effects.contains("discardopp:nonunique"):
		var opp_play: Array = pub.get("darkInPlay" if my_side == "light" else "lightInPlay", [])
		var loc_id := str(pub.get("startingLocationInstanceId", ""))
		var opp_side := "dark" if my_side == "light" else "light"
		for c in opp_play:
			if str(c.get("instanceId", "")) == loc_id or bool(c.get("faceDown", false)):
				continue
			var oinfo: Dictionary = CardCatalog.get_card_info(str(c.get("cardId", "")), opp_side, str(c.get("set", "")))
			if str(oinfo.get("type", "")).to_lower() == "location":
				continue
			if oinfo.get("uniqueness", true) == false or oinfo.get("unique", true) == false:
				return "ability"
	return ""


func _build_hand(state: RefCounted) -> void:
	if not hand_container:
		return
	for c in hand_container.get_children():
		c.queue_free()
	var g: Dictionary = state.game_state
	var phase: String = g.get("phase", "")
	var turn_side: String = g.get("turnSide", "")
	var my_side: String = state.game_side
	var pub: Dictionary = g.get("publicState", {})
	if location_choice_cards:
		for c in location_choice_cards.get_children():
			location_choice_cards.remove_child(c)
			c.queue_free()
		_fit_location_choices()
	if phase == "choose_starting_location" or phase == "choose_next_planet":
		if turn_side == my_side and location_choice_cards:
			var starting: bool = phase == "choose_starting_location"
			var choices: Array = pub.get("startingLocationChoices" if starting else "nextPlanetChoices", [])
			for choice in choices:
				var inst_id: String = choice.get("instanceId", "")
				var card_id: String = choice.get("cardId", "")
				if not card_id:
					continue
				var card: Control = CardPlaceholderScene.instantiate()
				location_choice_cards.add_child(card)
				card.set_card(card_id, inst_id, my_side, choice.get("set", ""))
				if card.has_method("set_board_size"):
					card.set_board_size(CHOICE_LOCATION_SIZE)
				card.card_selected.connect(_on_starting_location_chosen if starting else _on_next_planet_chosen)
			_fit_location_choices()
		return
	for entry in state.hand_with_instances:
		var inst_id: String = entry.get("instanceId", "")
		var card_id: String = entry.get("cardId", "")
		if _battle_cards_in_plan.has(inst_id) or _declared_battle_cards.has(inst_id):
			continue
		var card: Control = CardPlaceholderScene.instantiate()
		hand_container.add_child(card)
		card.set_card(card_id, inst_id, my_side, entry.get("set", ""))
		if _discard_location_mode:
			if _is_location_card(card_id, my_side, str(entry.get("set", ""))):
				if card.has_method("set_action_glow"):
					card.set_action_glow("play")
			else:
				card.modulate = Color(1, 1, 1, 0.4)
		elif card.has_method("set_action_glow") and (_hand_card_can_deploy(card_id, str(entry.get("set", "")), my_side, pub, phase, turn_side) or _hand_battle_card_ready(card_id, str(entry.get("set", "")), my_side, pub)):
			card.set_action_glow("play")
		card.button_pressed = (inst_id == _selected_instance_id)
		card.card_selected.connect(_on_card_selected)
		if card.has_signal("drag_started"):
			card.drag_started.connect(_on_hand_card_drag_started)
		if card.has_signal("drag_ended"):
			card.drag_ended.connect(_on_hand_card_drag_ended)


func _ensure_effect_decline_btn() -> void:
	if _effect_decline_btn != null and is_instance_valid(_effect_decline_btn):
		return
	if not pass_phase_btn:
		return
	var p: Node = pass_phase_btn.get_parent()
	if p == null:
		return
	_effect_decline_btn = Button.new()
	_effect_decline_btn.text = "Cancel effect"
	_effect_decline_btn.visible = false
	_effect_decline_btn.pressed.connect(_on_effect_decline_pressed)
	p.add_child(_effect_decline_btn)
	_style_action_button(_effect_decline_btn, "secondary")


func _on_effect_decline_pressed() -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "effect_decline" }
	})


func _on_my_in_play_effect_clicked(instance_id: String) -> void:
	if _picking_duel:
		_on_my_table_card_clicked(instance_id)
		return
	var g: Dictionary = Connection.get_state().game_state
	var phase: String = g.get("phase", "")
	var turn_side: String = g.get("turnSide", "")
	var my_side: String = Connection.get_state().game_side
	var pub: Dictionary = g.get("publicState", {})
	if turn_side != my_side:
		return
	if phase == "even_up":
		Connection.get_client().send_message({
			"type": "game_action",
			"action": { "kind": "effect_offer", "effectInstanceId": instance_id }
		})
		return
	if phase != "deploy":
		return
	var ep: Variant = pub.get("effectActivationPending", null)
	if ep is Dictionary and str(ep.get("side", "")) == my_side:
		status_label.text = "Discard a hand card or cancel the effect first."
		return
	var used: Array = pub.get("usedEffectsThisTurn", [])
	if used.has(instance_id):
		status_label.text = "This effect was already used this turn."
		return
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "effect_offer", "effectInstanceId": instance_id }
	})


func _on_my_table_card_clicked(instance_id: String) -> void:
	var my_side: String = Connection.get_state().game_side
	if not _picking_duel:
		var g: Dictionary = Connection.get_state().game_state
		if g.get("phase", "") == "deploy" and g.get("turnSide", "") == my_side:
			var pub: Dictionary = g.get("publicState", {})
			var deploy_cards: Array = pub.get("lightInPlay" if my_side == "light" else "darkInPlay", [])
			for c in deploy_cards:
				if str(c.get("instanceId", "")) != instance_id:
					continue
				if bool(c.get("faceDown", false)):
					var back_info: Dictionary = CardCatalog.get_card_info(str(c.get("cardId", "")), my_side, str(c.get("set", ""))) if CardCatalog else {}
					if str(back_info.get("type", "")).to_lower() == "character":
						Connection.get_client().send_message({
							"type": "game_action",
							"action": { "kind": "return_facedown_deploy", "instanceId": instance_id }
						})
					return
				if _card_bonus_text(str(c.get("cardId", ""))).contains("discardsearcher"):
					Connection.get_client().send_message({
						"type": "game_action",
						"action": { "kind": "start_in_play_deploy", "instanceId": instance_id }
					})
				return
		return
	var pub: Dictionary = Connection.get_state().game_state.get("publicState", {})
	var mine: Array = pub.get("lightInPlay" if my_side == "light" else "darkInPlay", [])
	var card_id: String = ""
	var card_set: String = ""
	for c in mine:
		if c.get("instanceId", "") == instance_id:
			card_id = c.get("cardId", "")
			card_set = str(c.get("set", ""))
			break
	if card_id.is_empty():
		return
	if _duel_char_id.is_empty():
		if _is_duelist_card(card_id, my_side) and _duelist_has_usable_saber(card_id, mine):
			_duel_char_id = instance_id
			status_label.text = "Fighter chosen. Click a highlighted lightsaber."
			_refresh()
		else:
			status_label.text = "Click a highlighted fighter first."
		return
	var chosen_id := ""
	for c in mine:
		if str(c.get("instanceId", "")) == _duel_char_id:
			chosen_id = str(c.get("cardId", ""))
			break
	if _is_lightsaber_card(card_id) and _weapon_fits_character(card_id, card_set, chosen_id):
		_duel_weapon_id = instance_id
		status_label.text = "Lightsaber chosen."
		_try_send_initiate_duel()
		return
	if _is_duelist_card(card_id, my_side) and _duelist_has_usable_saber(card_id, mine):
		_duel_char_id = instance_id
		_duel_weapon_id = ""
		status_label.text = "Fighter chosen. Click a highlighted lightsaber."
		_refresh()
		return
	status_label.text = "Click a highlighted lightsaber."


func _on_card_selected(instance_id: String) -> void:
	var g: Dictionary = Connection.get_state().game_state
	var phase: String = g.get("phase", "")
	var my_side: String = Connection.get_state().game_side
	var turn_side: String = g.get("turnSide", "")
	var pub: Dictionary = g.get("publicState", {})
	var ep: Variant = pub.get("effectActivationPending", null)
	if phase == "deploy" and turn_side == my_side and ep is Dictionary and str(ep.get("side", "")) == my_side:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": { "kind": "effect_discard_for_ability", "cardInstanceId": instance_id }
		})
		_selected_instance_id = ""
		_refresh()
		return
	var light: Dictionary = g.get("light", {})
	var dark: Dictionary = g.get("dark", {})
	var my_hand_count: int = int((light if my_side == "light" else dark).get("handCount", 0))
	if phase == "even_up" and turn_side == my_side and my_hand_count > 6:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": { "kind": "discard_from_hand", "instanceId": instance_id }
		})
		_refresh()
		return
	if phase == "even_up" and turn_side == my_side and _discard_location_mode:
		var card_id: String = ""
		var card_set: String = ""
		for entry in Connection.get_state().hand_with_instances:
			if entry.get("instanceId", "") == instance_id:
				card_id = entry.get("cardId", "")
				card_set = entry.get("set", "")
				break
		var is_loc: bool = false
		if card_id and CardCatalog:
			is_loc = str(CardCatalog.get_card_info(card_id, my_side, card_set).get("type", "")).to_lower() == "location"
		if is_loc:
			_discard_location_mode = false
			Connection.get_client().send_message({
				"type": "game_action",
				"action": { "kind": "discard_location", "instanceId": instance_id }
			})
			_refresh()
			return
		status_label.text = "That's not a location. Click a location card in your hand."
		return
	if _selected_instance_id == instance_id:
		_selected_instance_id = ""
	else:
		_selected_instance_id = instance_id
	_refresh()


func _build_starting_location_card(state: RefCounted, instance_id: String, pub: Dictionary) -> void:
	for c in starting_location_slot.get_children():
		c.queue_free()
	var my_side: String = state.game_side
	var light_in_play: Array = pub.get("lightInPlay", [])
	var dark_in_play: Array = pub.get("darkInPlay", [])
	for card in light_in_play:
		if card.get("instanceId", "") == instance_id:
			var card_id: String = card.get("cardId", "?")
			_set_starting_location_planet_label(card_id)
			var cp: Control = CardPlaceholderScene.instantiate()
			starting_location_slot.add_child(cp)
			cp.set_card(card_id, instance_id, "light")
			_size_board_card(cp, true)
			cp.card_selected.connect(_on_location_card_clicked)
			return
	for card in dark_in_play:
		if card.get("instanceId", "") == instance_id:
			var card_id: String = card.get("cardId", "?")
			_set_starting_location_planet_label(card_id)
			var cp: Control = CardPlaceholderScene.instantiate()
			starting_location_slot.add_child(cp)
			cp.set_card(card_id, instance_id, "dark")
			_size_board_card(cp, true)
			cp.card_selected.connect(_on_location_card_clicked)
			return
	if starting_location_label:
		starting_location_label.text = ""


func _on_location_card_clicked(instance_id: String) -> void:
	# Discard Location only affects cards in hand; table location clicks are ignored for that
	_refresh()


func _set_starting_location_planet_label(card_id: String) -> void:
	if not starting_location_label:
		return
	var planet: String = ""
	if CardCatalog:
		planet = CardCatalog.get_card_info(card_id, "").get("planet", "")
	starting_location_label.text = planet if planet else "Location"


## True if we can play this location during deploy to replace the current location (same planet, different card).
func _can_replace_location_with(location_card_id: String) -> bool:
	if not CardCatalog:
		return false
	var g: Dictionary = Connection.get_state().game_state
	var pub: Dictionary = g.get("publicState", {})
	var starting_inst_id: String = pub.get("startingLocationInstanceId", "")
	if starting_inst_id.is_empty():
		return false
	var current_card_id: String = ""
	for card in pub.get("lightInPlay", []):
		if card.get("instanceId", "") == starting_inst_id:
			current_card_id = card.get("cardId", "")
			break
	if current_card_id.is_empty():
		for card in pub.get("darkInPlay", []):
			if card.get("instanceId", "") == starting_inst_id:
				current_card_id = card.get("cardId", "")
				break
	if current_card_id.is_empty() or location_card_id == current_card_id:
		return false
	var current_planet: String = CardCatalog.get_card_info(current_card_id, "").get("planet", "")
	var new_planet: String = CardCatalog.get_card_info(location_card_id, "").get("planet", "")
	return current_planet != "" and current_planet == new_planet


func _build_battle_card_declare_ui(state: RefCounted, pub: Dictionary, declare_side: String) -> void:
	var section: VBoxContainer = battle_plan_section
	var my_side: String = state.game_side
	var is_my_turn: bool = (declare_side == my_side)
	var existing: Node = section.get_node_or_null("BattleCardDeclareUI")
	if existing:
		section.remove_child(existing)
		existing.queue_free()
	var container: VBoxContainer = VBoxContainer.new()
	container.name = "BattleCardDeclareUI"
	container.add_theme_constant_override("separation", 10)
	section.add_child(container)
	section.move_child(container, 0)
	if battle_plan_label:
		battle_plan_label.visible = false
	if is_my_turn:
		var prompt_label: Label = Label.new()
		prompt_label.text = "Drag Battle cards from your hand onto the table, then confirm."
		prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		prompt_label.add_theme_font_size_override("font_size", 14)
		prompt_label.add_theme_color_override("font_color", Color(0.95, 0.84, 0.5, 1))
		container.add_child(prompt_label)
		var btn_row: HBoxContainer = HBoxContainer.new()
		btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
		btn_row.add_theme_constant_override("separation", 12)
		container.add_child(btn_row)
		var confirm_btn: Button = Button.new()
		var declared_n: int = _declared_battle_cards.size()
		confirm_btn.text = "Confirm %d Battle card%s" % [declared_n, "" if declared_n == 1 else "s"] if declared_n > 0 else "Confirm — no Battle cards"
		_style_action_button(confirm_btn, "primary")
		confirm_btn.pressed.connect(_on_declare_battle_cards_confirmed)
		btn_row.add_child(confirm_btn)
		if not _declared_battle_cards.is_empty():
			var undo_btn: Button = Button.new()
			undo_btn.text = "Remove All"
			_style_action_button(undo_btn, "secondary")
			undo_btn.pressed.connect(_on_declare_battle_cards_clear)
			btn_row.add_child(undo_btn)
		status_label.text = ""
	else:
		var wait_label: Label = Label.new()
		wait_label.text = "Waiting for opponent to declare Battle cards…"
		wait_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		wait_label.add_theme_font_size_override("font_size", 14)
		wait_label.add_theme_color_override("font_color", Color(0.72, 0.76, 0.88, 1))
		container.add_child(wait_label)
		status_label.text = ""


func _on_declare_battle_cards_confirmed() -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "declare_battle_cards", "battleCardInstanceIds": _declared_battle_cards }
	})
	_refresh()


func _on_declare_battle_cards_clear() -> void:
	_declared_battle_cards.clear()
	_refresh()


func _on_declared_card_drag_started(instance_id: String) -> void:
	_dragging_instance_id = instance_id
	_dragging_from_battle_plan = true


func _on_declared_card_drag_ended(instance_id: String) -> void:
	var pos: Vector2 = get_global_mouse_position()
	var in_play_area: bool = _get_play_area_drop_rect().has_point(pos)
	if not in_play_area:
		_declared_battle_cards.erase(instance_id)
	_dragging_from_battle_plan = false
	_clear_drag_preview()
	_dragging_instance_id = ""
	_refresh()


func _build_battle_plan_row(_state: RefCounted, _pub: Dictionary) -> void:
	if not battle_plan_row:
		return
	for c in battle_plan_row.get_children():
		c.queue_free()
	battle_plan_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# Single row: cards are in your_play_container; instruction is the section's BattlePlanLabel (no duplicate here)


func _build_battle_cards_from_hand(state: RefCounted) -> void:
	var section: VBoxContainer = battle_plan_section
	var existing: Node = section.get_node_or_null("BattleCardsFromHand")
	if existing:
		existing.queue_free()
	var hand_cards: Array = state.hand_with_instances
	var my_side: String = state.game_side
	var available: Array = []
	for hc in hand_cards:
		var inst_id: String = hc.get("instanceId", "")
		var card_id: String = hc.get("cardId", "")
		if _battle_cards_in_plan.has(inst_id):
			continue
		if CardCatalog:
			var info: Dictionary = CardCatalog.get_card_info(card_id, my_side)
			if info.get("type", "") == "battle":
				available.append(hc)
	if available.is_empty():
		return
	var container: VBoxContainer = VBoxContainer.new()
	container.name = "BattleCardsFromHand"
	container.add_theme_constant_override("separation", 6)
	var label: Label = Label.new()
	label.text = "Battle Cards in hand (click to add to plan):"
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", Color(0.85, 0.75, 0.4, 1))
	container.add_child(label)
	var row: HBoxContainer = HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	container.add_child(row)
	for hc in available:
		var card_id: String = hc.get("cardId", "")
		var inst_id: String = hc.get("instanceId", "")
		var cp: Control = BattlePlanCardScene.instantiate()
		row.add_child(cp)
		cp.set_card(card_id, inst_id, my_side)
		cp.custom_minimum_size = Vector2(72, 102)
		if cp.has_signal("drag_started"):
			cp.drag_started.connect(_on_battle_card_from_hand_clicked.bind(inst_id))
	var ready_idx: int = -1
	for i in range(section.get_child_count()):
		if section.get_child(i) == battle_plan_ready_btn:
			ready_idx = i
			break
	if ready_idx >= 0:
		section.add_child(container)
		section.move_child(container, ready_idx)
	else:
		section.add_child(container)


func _on_battle_card_from_hand_clicked(instance_id: String) -> void:
	if _battle_cards_in_plan.has(instance_id):
		return
	_battle_cards_in_plan.append(instance_id)
	_battle_plan_order.append(instance_id)
	_refresh()


func _on_battle_plan_drag_started(instance_id: String) -> void:
	_dragging_from_battle_plan = true
	_on_hand_card_drag_started(instance_id)


func _on_battle_plan_drag_ended(instance_id: String) -> void:
	var pos: Vector2 = get_global_mouse_position()
	var new_index: int = -1
	var pub: Dictionary = Connection.get_state().game_state.get("publicState", {})
	var in_battle_plan: bool = pub.get("battlePlanPhase", false)
	var row: Control = null
	if in_battle_plan and your_play_container and your_play_container.get_child_count() > 0:
		row = your_play_container
	elif battle_plan_row and battle_plan_row.get_child_count() > 0:
		row = battle_plan_row
	if row:
		var children: Array = row.get_children()
		if not children.is_empty():
			for i in range(children.size()):
				var c: Control = children[i] as Control
				var rect: Rect2 = c.get_global_rect()
				if rect.has_point(pos):
					new_index = i
					break
			if new_index < 0:
				var first_rect: Rect2 = (children[0] as Control).get_global_rect()
				var last_rect: Rect2 = (children[children.size() - 1] as Control).get_global_rect()
				if pos.x <= first_rect.position.x + first_rect.size.x * 0.5:
					new_index = 0
				elif pos.x >= last_rect.position.x + last_rect.size.x * 0.5:
					new_index = children.size()
				else:
					for i in range(children.size() - 1):
						var left_c: Control = children[i] as Control
						var right_c: Control = children[i + 1] as Control
						var mid_x: float = (left_c.get_global_rect().end.x + right_c.get_global_rect().position.x) * 0.5
						if pos.x < mid_x:
							new_index = i + 1
							break
					if new_index < 0:
						new_index = children.size()
	if new_index >= 0 and _battle_plan_order.has(instance_id):
		var idx: int = _battle_plan_order.find(instance_id)
		_battle_plan_order.remove_at(idx)
		if new_index > idx:
			new_index -= 1
		new_index = clampi(new_index, 0, _battle_plan_order.size())
		_battle_plan_order.insert(new_index, instance_id)
	_dragging_from_battle_plan = false
	_clear_drag_preview()
	_dragging_instance_id = ""
	_refresh()


func _on_battle_plan_ready_pressed() -> void:
	if _battle_plan_order.is_empty():
		return
	status_label.text = "Submitting battle plan…"
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "battle_plan_ready", "instanceIds": _battle_plan_order }
	})
	# Do not _refresh() here: it overwrites status before the server error arrives on reject.
	# Success path refreshes via game_state_updated.


func _ensure_battle_reveal_overlay() -> void:
	if _battle_reveal_overlay and is_instance_valid(_battle_reveal_overlay):
		return
	_battle_reveal_overlay = CanvasLayer.new()
	_battle_reveal_overlay.layer = 200
	add_child(_battle_reveal_overlay)
	var backdrop: ColorRect = ColorRect.new()
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.color = Color(0.03, 0.04, 0.08, 0.95)
	backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	_battle_reveal_overlay.add_child(backdrop)
	var space_bg: TextureRect = TextureRect.new()
	space_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	space_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	space_bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	space_bg.modulate = Color(1, 1, 1, 0.15)
	space_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg_tex: Texture2D = load("res://assets/space_background.png") as Texture2D
	if bg_tex:
		space_bg.texture = bg_tex
		_battle_reveal_overlay.add_child(space_bg)
	var grad_top: ColorRect = ColorRect.new()
	grad_top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	grad_top.offset_bottom = 80
	grad_top.color = Color(0.05, 0.08, 0.18, 0.6)
	grad_top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_battle_reveal_overlay.add_child(grad_top)
	var grad_bot: ColorRect = ColorRect.new()
	grad_bot.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	grad_bot.offset_top = -80
	grad_bot.color = Color(0.05, 0.05, 0.12, 0.5)
	grad_bot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_battle_reveal_overlay.add_child(grad_bot)
	_battle_reveal_panel = PanelContainer.new()
	_battle_reveal_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_battle_reveal_panel.offset_left = 20
	_battle_reveal_panel.offset_top = 10
	_battle_reveal_panel.offset_right = -20
	_battle_reveal_panel.offset_bottom = -10
	var ps: StyleBoxFlat = StyleBoxFlat.new()
	ps.bg_color = Color(0.03, 0.05, 0.12, 0.94)
	ps.set_border_width_all(1)
	ps.border_color = Color(0.86, 0.72, 0.32, 0.45)
	ps.set_corner_radius_all(12)
	ps.set_content_margin_all(12)
	_battle_reveal_panel.add_theme_stylebox_override("panel", ps)
	_battle_reveal_overlay.add_child(_battle_reveal_panel)
	var main_vbox: VBoxContainer = VBoxContainer.new()
	main_vbox.add_theme_constant_override("separation", 4)
	_battle_reveal_panel.add_child(main_vbox)
	# --- Top bar: [light pile]  [title]  [dark pile] ---
	var top_bar: HBoxContainer = HBoxContainer.new()
	top_bar.name = "TopBar"
	top_bar.add_theme_constant_override("separation", 8)
	main_vbox.add_child(top_bar)
	var lpile: HBoxContainer = HBoxContainer.new()
	lpile.name = "LightPileInfo"
	lpile.add_theme_constant_override("separation", 4)
	var lptex: TextureRect = TextureRect.new()
	lptex.name = "PileTex"
	lptex.custom_minimum_size = Vector2(22, 32)
	lptex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	lptex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	lptex.texture = CARD_BACK_LIGHT
	lpile.add_child(lptex)
	var lplbl: Label = Label.new()
	lplbl.name = "PileCount"
	lplbl.add_theme_font_size_override("font_size", 11)
	lplbl.add_theme_color_override("font_color", Color(0.55, 0.75, 1.0, 1))
	lpile.add_child(lplbl)
	top_bar.add_child(lpile)
	var title_lbl: Label = Label.new()
	title_lbl.name = "BattleRevealTitle"
	title_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_lbl.theme_type_variation = &"HeaderLabel"
	title_lbl.add_theme_font_size_override("font_size", 18)
	top_bar.add_child(title_lbl)
	var dpile: HBoxContainer = HBoxContainer.new()
	dpile.name = "DarkPileInfo"
	dpile.add_theme_constant_override("separation", 4)
	var dptex: TextureRect = TextureRect.new()
	dptex.name = "PileTex"
	dptex.custom_minimum_size = Vector2(22, 32)
	dptex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	dptex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	dptex.texture = CARD_BACK_DARK
	dpile.add_child(dptex)
	var dplbl: Label = Label.new()
	dplbl.name = "PileCount"
	dplbl.add_theme_font_size_override("font_size", 11)
	dplbl.add_theme_color_override("font_color", Color(1.0, 0.5, 0.45, 1))
	dpile.add_child(dplbl)
	top_bar.add_child(dpile)
	# --- Fight area: [LightColumn] [VS] [DarkColumn] ---
	var fight_area: HBoxContainer = HBoxContainer.new()
	fight_area.name = "FightArea"
	fight_area.add_theme_constant_override("separation", 0)
	fight_area.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fight_area.size_flags_stretch_ratio = 3.0
	main_vbox.add_child(fight_area)
	_build_side_panel(fight_area, "light")
	var vs_vbox: VBoxContainer = VBoxContainer.new()
	vs_vbox.name = "VSDivider"
	vs_vbox.custom_minimum_size.x = 64
	vs_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	var vs_circle: PanelContainer = PanelContainer.new()
	vs_circle.custom_minimum_size = Vector2(56, 56)
	var vs_style: StyleBoxFlat = StyleBoxFlat.new()
	vs_style.bg_color = Color(0.05, 0.08, 0.17, 0.95)
	vs_style.corner_radius_top_left = 28
	vs_style.corner_radius_top_right = 28
	vs_style.corner_radius_bottom_left = 28
	vs_style.corner_radius_bottom_right = 28
	vs_style.border_width_left = 2
	vs_style.border_width_top = 2
	vs_style.border_width_right = 2
	vs_style.border_width_bottom = 2
	vs_style.border_color = Color(0.85, 0.75, 0.35, 0.8)
	vs_style.set_content_margin_all(0)
	vs_circle.add_theme_stylebox_override("panel", vs_style)
	var vs_lbl: Label = Label.new()
	vs_lbl.text = "VS"
	vs_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vs_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	vs_lbl.add_theme_font_size_override("font_size", 20)
	vs_lbl.add_theme_color_override("font_color", Color(0.95, 0.85, 0.4, 1))
	vs_circle.add_child(vs_lbl)
	vs_vbox.add_child(vs_circle)
	fight_area.add_child(vs_vbox)
	_build_side_panel(fight_area, "dark")
	# --- Bottom info area (fixed space so fight area doesn't shift) ---
	var bottom_area: VBoxContainer = VBoxContainer.new()
	bottom_area.name = "BottomInfoArea"
	bottom_area.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bottom_area.size_flags_stretch_ratio = 1.0
	bottom_area.add_theme_constant_override("separation", 4)
	main_vbox.add_child(bottom_area)
	# --- Destiny section (per-side) ---
	var destiny_hbox: HBoxContainer = HBoxContainer.new()
	destiny_hbox.name = "DestinySection"
	destiny_hbox.add_theme_constant_override("separation", 12)
	destiny_hbox.visible = false
	bottom_area.add_child(destiny_hbox)
	for side_key in ["light", "dark"]:
		var dcol: VBoxContainer = VBoxContainer.new()
		dcol.name = side_key.capitalize() + "DestinyCol"
		dcol.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		dcol.add_theme_constant_override("separation", 2)
		var dlbl: Label = Label.new()
		dlbl.name = "DestinyLabel"
		dlbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		dlbl.add_theme_font_size_override("font_size", 12)
		dlbl.add_theme_color_override("font_color", Color(0.5, 0.8, 1.0, 1) if side_key == "light" else Color(1.0, 0.5, 0.5, 1))
		dcol.add_child(dlbl)
		var drow: HBoxContainer = HBoxContainer.new()
		drow.name = "DestinyCardsRow"
		drow.alignment = BoxContainer.ALIGNMENT_CENTER
		drow.add_theme_constant_override("separation", 3)
		dcol.add_child(drow)
		destiny_hbox.add_child(dcol)
	# --- Winner banner (code-styled panel) ---
	var winner_wrap: CenterContainer = CenterContainer.new()
	winner_wrap.name = "WinnerBannerWrap"
	winner_wrap.visible = false
	bottom_area.add_child(winner_wrap)
	var winner_panel: PanelContainer = PanelContainer.new()
	winner_panel.name = "WinnerBannerPanel"
	winner_panel.custom_minimum_size = Vector2(280, 40)
	var wps: StyleBoxFlat = StyleBoxFlat.new()
	wps.bg_color = Color(0.04, 0.06, 0.14, 0.95)
	wps.border_width_left = 2
	wps.border_width_top = 2
	wps.border_width_right = 2
	wps.border_width_bottom = 2
	wps.border_color = Color(0.85, 0.75, 0.35, 0.8)
	wps.corner_radius_top_left = 6
	wps.corner_radius_top_right = 6
	wps.corner_radius_bottom_left = 6
	wps.corner_radius_bottom_right = 6
	wps.set_content_margin_all(8)
	winner_panel.add_theme_stylebox_override("panel", wps)
	winner_wrap.add_child(winner_panel)
	var winner_lbl: Label = Label.new()
	winner_lbl.name = "WinnerBanner"
	winner_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	winner_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	winner_lbl.add_theme_font_size_override("font_size", 20)
	winner_lbl.add_theme_color_override("font_color", Color(0.95, 0.85, 0.4, 1))
	winner_panel.add_child(winner_lbl)
	# --- Hidden result text (backward-compat; formula stays here) ---
	var result_rtl: RichTextLabel = RichTextLabel.new()
	result_rtl.name = "BattleRevealResult"
	result_rtl.bbcode_enabled = true
	result_rtl.fit_content = true
	result_rtl.scroll_active = false
	result_rtl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	result_rtl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	result_rtl.add_theme_font_size_override("normal_font_size", 12)
	result_rtl.visible = false
	bottom_area.add_child(result_rtl)
	# --- Damage / mill section ---
	var damage_sec: VBoxContainer = VBoxContainer.new()
	damage_sec.name = "BattleRevealDamageSection"
	damage_sec.visible = false
	damage_sec.add_theme_constant_override("separation", 4)
	bottom_area.add_child(damage_sec)
	var dam_lbl: Label = Label.new()
	dam_lbl.name = "DamageLabel"
	dam_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	dam_lbl.add_theme_font_size_override("font_size", 13)
	dam_lbl.add_theme_color_override("font_color", Color(1.0, 0.4, 0.4, 1))
	damage_sec.add_child(dam_lbl)
	var dam_row: HBoxContainer = HBoxContainer.new()
	dam_row.name = "DamageCardsRow"
	dam_row.add_theme_constant_override("separation", 6)
	dam_row.alignment = BoxContainer.ALIGNMENT_CENTER
	damage_sec.add_child(dam_row)
	_battle_reveal_timer = Timer.new()
	_battle_reveal_timer.one_shot = true
	add_child(_battle_reveal_timer)


func _build_side_panel(parent: Control, side: String) -> void:
	var column: PanelContainer = PanelContainer.new()
	column.name = side.capitalize() + "Column"
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var cs: StyleBoxFlat = StyleBoxFlat.new()
	var side_color: Color = SIDE_COLOR_LIGHT if side == "light" else SIDE_COLOR_DARK
	cs.bg_color = Color(0.05, 0.08, 0.17, 0.85)
	cs.set_border_width_all(2)
	cs.border_color = Color(side_color.r, side_color.g, side_color.b, 0.55)
	cs.set_corner_radius_all(10)
	cs.set_content_margin_all(10)
	column.add_theme_stylebox_override("panel", cs)
	parent.add_child(column)
	var vb: VBoxContainer = VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	vb.alignment = BoxContainer.ALIGNMENT_BEGIN
	column.add_child(vb)
	var sl: Label = Label.new()
	sl.name = "SideLabel"
	sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sl.theme_type_variation = &"HeaderLabel"
	sl.add_theme_font_size_override("font_size", 13)
	sl.add_theme_color_override("font_color", side_color)
	sl.text = side.to_upper()
	vb.add_child(sl)
	var bca: VBoxContainer = VBoxContainer.new()
	bca.name = "BattleCardArea"
	bca.visible = false
	bca.add_theme_constant_override("separation", 1)
	var bch: Label = Label.new()
	bch.text = "BATTLE CARD"
	bch.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bch.add_theme_font_size_override("font_size", 9)
	bch.add_theme_color_override("font_color", Color(0.9, 0.8, 0.35, 0.7))
	bca.add_child(bch)
	var bcs: CenterContainer = CenterContainer.new()
	bcs.name = "BattleCardSlot"
	bca.add_child(bcs)
	var bcn: Label = Label.new()
	bcn.name = "BattleCardName"
	bcn.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bcn.add_theme_font_size_override("font_size", 9)
	bcn.add_theme_color_override("font_color", Color(0.8, 0.75, 0.6, 1))
	bca.add_child(bcn)
	vb.add_child(bca)
	var cnl: Label = Label.new()
	cnl.name = "CharNameLabel"
	cnl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	cnl.add_theme_font_size_override("font_size", 13)
	cnl.add_theme_color_override("font_color", Color(0.95, 0.92, 0.82, 1))
	cnl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cnl.visible = false
	vb.add_child(cnl)
	var fa: HBoxContainer = HBoxContainer.new()
	fa.name = "FighterArea"
	fa.add_theme_constant_override("separation", 4)
	fa.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_child(fa)
	var power_wrap: CenterContainer = CenterContainer.new()
	power_wrap.name = "PowerWrap"
	power_wrap.visible = false
	var power_pill: PanelContainer = PanelContainer.new()
	power_pill.custom_minimum_size = Vector2(60, 0)
	var pp_style: StyleBoxFlat = StyleBoxFlat.new()
	pp_style.bg_color = Color(0.08, 0.1, 0.18, 0.9)
	pp_style.border_width_left = 2
	pp_style.border_width_top = 2
	pp_style.border_width_right = 2
	pp_style.border_width_bottom = 2
	pp_style.border_color = Color(0.4, 0.65, 0.9, 0.6) if side == "light" else Color(0.85, 0.3, 0.25, 0.6)
	pp_style.corner_radius_top_left = 16
	pp_style.corner_radius_top_right = 16
	pp_style.corner_radius_bottom_left = 16
	pp_style.corner_radius_bottom_right = 16
	pp_style.set_content_margin_all(4)
	power_pill.add_theme_stylebox_override("panel", pp_style)
	var pl: Label = Label.new()
	pl.name = "PowerLabel"
	pl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pl.add_theme_font_size_override("font_size", 22)
	pl.add_theme_color_override("font_color", Color(1, 1, 1, 1))
	power_pill.add_child(pl)
	power_wrap.add_child(power_pill)
	vb.add_child(power_wrap)
	var bl: RichTextLabel = RichTextLabel.new()
	bl.name = "BreakdownLabel"
	bl.bbcode_enabled = true
	bl.fit_content = true
	bl.scroll_active = false
	bl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bl.add_theme_font_size_override("normal_font_size", 13)
	bl.visible = false
	bl.custom_minimum_size.y = 18
	vb.add_child(bl)


func _load_card_texture_for_id(card_id: String, side_str: String) -> Texture2D:
	if CardCatalog:
		var paths_to_try: Array[String] = CardCatalog.get_card_image_paths(card_id, side_str)
		for p in paths_to_try:
			var tex: Texture2D = load(p) as Texture2D
			if tex:
				return tex
	return CARD_BACK_LIGHT if side_str == "light" else CARD_BACK_DARK


func _start_battle_reveal_animation(sequence: Array) -> void:
	_battle_reveal_sequence.clear()
	for item in sequence:
		_battle_reveal_sequence.append(item)
	_battle_reveal_index = 0
	_battle_mill_queue.clear()
	_battle_mill_index = 0
	_battle_mill_side = ""
	_ensure_battle_reveal_overlay()
	_battle_reveal_overlay.visible = true
	_show_battle_reveal_step()


func _create_battle_card(card_id: String, side_str: String, w: float, h: float, slide_from: float, show_frame: bool = false) -> Control:
	var card_wrapper: Control = Control.new()
	card_wrapper.custom_minimum_size = Vector2(w, h)
	card_wrapper.clip_contents = false
	var tex_rect: TextureRect = TextureRect.new()
	tex_rect.set_anchors_preset(Control.PRESET_TOP_LEFT)
	tex_rect.offset_left = 0
	tex_rect.offset_top = slide_from
	tex_rect.offset_right = w
	tex_rect.offset_bottom = slide_from + h
	tex_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	tex_rect.texture = _load_card_texture_for_id(card_id, side_str)
	card_wrapper.add_child(tex_rect)
	if show_frame:
		var frame_panel: Panel = Panel.new()
		frame_panel.set_anchors_preset(Control.PRESET_TOP_LEFT)
		frame_panel.offset_left = -1
		frame_panel.offset_top = slide_from - 1
		frame_panel.offset_right = w + 1
		frame_panel.offset_bottom = slide_from + h + 1
		frame_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var fsb: StyleBoxFlat = StyleBoxFlat.new()
		fsb.bg_color = Color(0, 0, 0, 0)
		fsb.border_width_left = 2
		fsb.border_width_top = 2
		fsb.border_width_right = 2
		fsb.border_width_bottom = 2
		var frame_col: Color = Color(0.4, 0.7, 1.0, 0.7) if side_str == "light" else Color(1.0, 0.35, 0.25, 0.7)
		fsb.border_color = frame_col
		fsb.corner_radius_top_left = 3
		fsb.corner_radius_top_right = 3
		fsb.corner_radius_bottom_left = 3
		fsb.corner_radius_bottom_right = 3
		fsb.shadow_color = Color(frame_col.r, frame_col.g, frame_col.b, 0.3)
		fsb.shadow_size = 4
		frame_panel.add_theme_stylebox_override("panel", fsb)
		card_wrapper.add_child(frame_panel)
		var ftween: Tween = card_wrapper.create_tween()
		ftween.set_ease(Tween.EASE_OUT)
		ftween.set_trans(Tween.TRANS_BACK)
		ftween.tween_property(frame_panel, "offset_top", -1.0, 0.45)
		ftween.parallel().tween_property(frame_panel, "offset_bottom", h + 1.0, 0.45)
	var tween: Tween = card_wrapper.create_tween()
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_BACK)
	tween.tween_property(tex_rect, "offset_top", 0.0, 0.45)
	tween.parallel().tween_property(tex_rect, "offset_bottom", h, 0.45)
	return card_wrapper


func _create_weapon_with_badge(weapon_id: String, side_str: String, w: float, h: float) -> Control:
	var wrapper: VBoxContainer = VBoxContainer.new()
	wrapper.add_theme_constant_override("separation", 1)
	wrapper.alignment = BoxContainer.ALIGNMENT_CENTER
	var card: Control = _create_battle_card(weapon_id, side_str, w, h, h * 0.55)
	wrapper.add_child(card)
	var wname: String = ""
	if CardCatalog:
		wname = CardCatalog.get_card_info(weapon_id, side_str).get("name", weapon_id)
	if wname.length() > 18:
		wname = wname.substr(0, 18) + "…"
	var badge_hbox: HBoxContainer = HBoxContainer.new()
	badge_hbox.add_theme_constant_override("separation", 2)
	badge_hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	var sword_lbl: Label = Label.new()
	sword_lbl.text = "\u2694"
	sword_lbl.add_theme_font_size_override("font_size", 10)
	sword_lbl.add_theme_color_override("font_color", Color(0.45, 0.85, 0.45, 1))
	badge_hbox.add_child(sword_lbl)
	var nlbl: Label = Label.new()
	nlbl.text = wname
	nlbl.add_theme_font_size_override("font_size", 8)
	nlbl.add_theme_color_override("font_color", Color(0.6, 0.85, 0.6, 1))
	badge_hbox.add_child(nlbl)
	wrapper.add_child(badge_hbox)
	return wrapper


## Card sizes in the reveal are tuned for a 720px-tall window; grow them on taller
## windows so the columns fill, but never wider than a column can hold.
## The labels, power pill and breakdown under the cards don't scale, so only the
## card heights (fighter + battle card) share the spare column height.
const REVEAL_FIXED_COLUMN_H := 210.0
const REVEAL_BATTLE_CARD_H := 96.0

func _battle_reveal_scale(row_w: float, base_card_h: float) -> float:
	var vp: Vector2 = get_viewport().get_visible_rect().size
	var fight: Control = _battle_reveal_panel.find_child("FightArea", true, false) as Control
	var avail: float = (vp.y - 84.0) * 0.75 - 24.0
	if fight and fight.size.y > 10.0:
		avail = fight.size.y - 24.0
	var s: float = clampf((avail - REVEAL_FIXED_COLUMN_H) / (base_card_h + REVEAL_BATTLE_CARD_H), 1.0, 2.2)
	var col_w: float = (vp.x - 40.0 - 24.0 - 64.0) / 2.0 - 24.0
	if row_w > 0.0:
		s = minf(s, col_w / row_w)
	return maxf(s, 0.6)


func _populate_side_fighters(side: String, char_id: String, weapon_id: String, bc_id: String, char_id2: String = "", weapon_id2: String = "", char_id3: String = "", weapon_id3: String = "") -> void:
	var col: PanelContainer = _battle_reveal_panel.find_child(side.capitalize() + "Column", true, false) as PanelContainer
	if not col:
		return
	var fighter_area: HBoxContainer = col.find_child("FighterArea", true, false) as HBoxContainer
	if not fighter_area:
		return
	for c in fighter_area.get_children():
		c.queue_free()
	var multi: bool = not char_id2.is_empty()
	var has_3: bool = not char_id3.is_empty()
	var cw: float = 136.0
	var ch: float = 192.0
	var ww: float = 88.0
	var wh: float = 124.0
	if has_3:
		cw = 78.0
		ch = 110.0
		ww = 52.0
		wh = 73.0
	elif multi:
		cw = 100.0
		ch = 142.0
		ww = 64.0
		wh = 90.0
	var row_w: float = 0.0
	for pair in [[char_id, weapon_id], [char_id2, weapon_id2], [char_id3, weapon_id3]]:
		if str(pair[0]).is_empty():
			continue
		row_w += cw + 4.0
		if not str(pair[1]).is_empty():
			row_w += ww + 4.0
	var s: float = _battle_reveal_scale(row_w, ch)
	cw *= s
	ch *= s
	ww *= s
	wh *= s
	if not weapon_id.is_empty():
		fighter_area.add_child(_create_weapon_with_badge(weapon_id, side, ww, wh))
	fighter_area.add_child(_create_battle_card(char_id, side, cw, ch, ch * 0.55))
	if not char_id2.is_empty():
		if not weapon_id2.is_empty():
			fighter_area.add_child(_create_weapon_with_badge(weapon_id2, side, ww, wh))
		fighter_area.add_child(_create_battle_card(char_id2, side, cw, ch, ch * 0.55))
	if not char_id3.is_empty():
		if not weapon_id3.is_empty():
			fighter_area.add_child(_create_weapon_with_badge(weapon_id3, side, ww, wh))
		fighter_area.add_child(_create_battle_card(char_id3, side, cw, ch, ch * 0.55))
	var bc_area: VBoxContainer = col.find_child("BattleCardArea", true, false) as VBoxContainer
	if bc_area:
		var bc_slot: CenterContainer = bc_area.find_child("BattleCardSlot", true, false) as CenterContainer
		if bc_slot:
			for c2 in bc_slot.get_children():
				c2.queue_free()
		if not bc_id.is_empty() and bc_slot:
			bc_area.visible = true
			bc_slot.add_child(_create_battle_card(bc_id, side, 68.0 * s, 96.0 * s, 48.0 * s))
			var bcn: Label = bc_area.find_child("BattleCardName", true, false) as Label
			if bcn and CardCatalog:
				var nm: String = CardCatalog.get_card_info(bc_id, side).get("name", bc_id)
				if nm.length() > 22:
					nm = nm.substr(0, 22) + "…"
				bcn.text = nm
		else:
			bc_area.visible = false


func _show_battle_reveal_step() -> void:
	if _battle_reveal_index < 0 or _battle_reveal_index >= _battle_reveal_sequence.size():
		return
	var step: Dictionary = _battle_reveal_sequence[_battle_reveal_index]
	var step_type: String = step.get("type", "paired")
	var my_side: String = Connection.get_state().game_side
	var title: Label = _battle_reveal_panel.find_child("BattleRevealTitle", true, false) as Label
	if title:
		if step_type == "unopposed":
			title.text = "Battle — Unopposed (%d of %d)" % [_battle_reveal_index + 1, _battle_reveal_sequence.size()]
		else:
			title.text = "Battle — Reveal %d of %d" % [_battle_reveal_index + 1, _battle_reveal_sequence.size()]
	# Pile counts
	var top_bar: HBoxContainer = _battle_reveal_panel.find_child("TopBar", true, false) as HBoxContainer
	if top_bar:
		var lpi: HBoxContainer = top_bar.find_child("LightPileInfo", false, false) as HBoxContainer
		var dpi: HBoxContainer = top_bar.find_child("DarkPileInfo", false, false) as HBoxContainer
		if step_type == "unopposed":
			if lpi: lpi.visible = false
			if dpi: dpi.visible = false
		else:
			if lpi: lpi.visible = true
			if dpi: dpi.visible = true
			var paired_remaining: int = 0
			for i in range(_battle_reveal_index, _battle_reveal_sequence.size()):
				if _battle_reveal_sequence[i].get("type", "paired") == "paired":
					paired_remaining += 1
			if lpi:
				var lpc: Label = lpi.find_child("PileCount", false, false) as Label
				if lpc:
					lpc.text = "%s: %d" % ["You" if my_side == "light" else "Opp", paired_remaining]
			if dpi:
				var dpc: Label = dpi.find_child("PileCount", false, false) as Label
				if dpc:
					dpc.text = "%s: %d" % ["You" if my_side == "dark" else "Opp", paired_remaining]
	# Reset both columns
	for sk in ["Light", "Dark"]:
		var col: PanelContainer = _battle_reveal_panel.find_child(sk + "Column", true, false) as PanelContainer
		if not col:
			continue
		col.modulate = Color(1, 1, 1, 1)
		col.visible = true
		var fa: HBoxContainer = col.find_child("FighterArea", true, false) as HBoxContainer
		if fa:
			for c in fa.get_children():
				c.queue_free()
		var bca: VBoxContainer = col.find_child("BattleCardArea", true, false) as VBoxContainer
		if bca:
			bca.visible = false
			var bcs: CenterContainer = bca.find_child("BattleCardSlot", true, false) as CenterContainer
			if bcs:
				for c in bcs.get_children():
					c.queue_free()
		var cnl: Label = col.find_child("CharNameLabel", true, false) as Label
		if cnl: cnl.visible = false
		var pw: CenterContainer = col.find_child("PowerWrap", true, false) as CenterContainer
		if pw: pw.visible = false
		var bl: RichTextLabel = col.find_child("BreakdownLabel", true, false) as RichTextLabel
		if bl:
			bl.visible = false
			bl.text = ""
		var sl: Label = col.find_child("SideLabel", true, false) as Label
		if sl:
			if sk == "Light":
				sl.text = "YOUR SIDE" if my_side == "light" else "OPPONENT"
			else:
				sl.text = "YOUR SIDE" if my_side == "dark" else "OPPONENT"
	# Hide bottom elements
	var result_label: RichTextLabel = _battle_reveal_panel.find_child("BattleRevealResult", true, false) as RichTextLabel
	if result_label: result_label.visible = false
	var winner_wrap: CenterContainer = _battle_reveal_panel.find_child("WinnerBannerWrap", true, false) as CenterContainer
	if winner_wrap: winner_wrap.visible = false
	var destiny_section: HBoxContainer = _battle_reveal_panel.find_child("DestinySection", true, false) as HBoxContainer
	if destiny_section:
		destiny_section.visible = false
		for sk2 in ["Light", "Dark"]:
			var dcol: VBoxContainer = destiny_section.find_child(sk2 + "DestinyCol", true, false) as VBoxContainer
			if dcol:
				var drow: HBoxContainer = dcol.find_child("DestinyCardsRow", true, false) as HBoxContainer
				if drow:
					for c in drow.get_children():
						c.queue_free()
	var damage_section: VBoxContainer = _battle_reveal_panel.find_child("BattleRevealDamageSection", true, false) as VBoxContainer
	if damage_section: damage_section.visible = false
	var damage_cards_row: HBoxContainer = _battle_reveal_panel.find_child("DamageCardsRow", true, false) as HBoxContainer
	if damage_cards_row:
		for c in damage_cards_row.get_children():
			c.queue_free()
	# VS divider
	var vs_div: VBoxContainer = _battle_reveal_panel.find_child("VSDivider", true, false) as VBoxContainer
	if vs_div:
		vs_div.visible = step_type != "unopposed"
	# Hide empty side for unopposed
	var light_id: String = step.get("lightCardId", "")
	var dark_id: String = step.get("darkCardId", "")
	if step_type == "unopposed":
		if light_id.is_empty():
			var lcol: PanelContainer = _battle_reveal_panel.find_child("LightColumn", true, false) as PanelContainer
			if lcol: lcol.visible = false
		if dark_id.is_empty():
			var dcol2: PanelContainer = _battle_reveal_panel.find_child("DarkColumn", true, false) as PanelContainer
			if dcol2: dcol2.visible = false
	# Populate fighters into columns
	if light_id != "":
		_populate_side_fighters("light", light_id, step.get("lightWeaponCardId", ""), step.get("lightBattleCardId", ""), step.get("lightCardId2", ""), step.get("lightWeaponCardId2", ""), step.get("lightCardId3", ""), step.get("lightWeaponCardId3", ""))
	if dark_id != "":
		_populate_side_fighters("dark", dark_id, step.get("darkWeaponCardId", ""), step.get("darkBattleCardId", ""), step.get("darkCardId2", ""), step.get("darkWeaponCardId2", ""), step.get("darkCardId3", ""), step.get("darkWeaponCardId3", ""))
	var saved_index: int = _battle_reveal_index
	get_tree().create_timer(2.0).timeout.connect(func() -> void:
		if _battle_reveal_index == saved_index:
			_battle_step_show_result()
	)


func _build_power_string(char_name: String, total_power: int, loc_bonus: int, weapon_name: String, weapon_bonus: int, battle_card_name: String = "", battle_card_bonus: int = 0, gametext_bonus_label: String = "") -> String:
	var s: String = "%s %d" % [_format_card_name(char_name), total_power]
	var bonuses: Array[String] = []
	if battle_card_bonus > 0:
		bonuses.append("%s +%d" % [_format_card_name(battle_card_name), battle_card_bonus])
	if weapon_bonus > 0:
		bonuses.append("%s +%d" % [_format_card_name(weapon_name), weapon_bonus])
	if loc_bonus > 0:
		bonuses.append("location +%d" % loc_bonus)
	if not gametext_bonus_label.is_empty():
		bonuses.append(gametext_bonus_label)
	if not bonuses.is_empty():
		s += " (" + ", ".join(bonuses) + ")"
	return s


func _build_combined_power_string(
	name1: String, base1: int, loc1: int, weapon_name1: String, weapon_bonus1: int,
	name2: String, base2: int, loc2: int, weapon_name2: String, weapon_bonus2: int,
	bc_name: String, bc_bonus: int, total: int, gametext_bonus_label: String = ""
) -> String:
	var parts: Array[String] = []
	parts.append("%s %d" % [_format_card_name(name1), base1])
	parts.append("%s %d" % [_format_card_name(name2), base2])
	var s: String = " + ".join(parts)
	var bonuses: Array[String] = []
	if bc_bonus > 0:
		bonuses.append("%s +%d" % [_format_card_name(bc_name), bc_bonus])
	if weapon_bonus1 > 0:
		bonuses.append("%s +%d" % [_format_card_name(weapon_name1), weapon_bonus1])
	if weapon_bonus2 > 0:
		bonuses.append("%s +%d" % [_format_card_name(weapon_name2), weapon_bonus2])
	var total_loc: int = loc1 + loc2
	if total_loc > 0:
		bonuses.append("location +%d" % total_loc)
	if not gametext_bonus_label.is_empty():
		bonuses.append(gametext_bonus_label)
	if not bonuses.is_empty():
		s += " (" + ", ".join(bonuses) + ")"
	s += " = %d" % total
	return s


func _build_combined_power_string_3(
	name1: String, base1: int, loc1: int, weapon_name1: String, weapon_bonus1: int,
	name2: String, base2: int, loc2: int, weapon_name2: String, weapon_bonus2: int,
	name3: String, base3: int, loc3: int, weapon_name3: String, weapon_bonus3: int,
	bc_name: String, bc_bonus: int, total: int, gametext_bonus_label: String = ""
) -> String:
	var parts: Array[String] = []
	parts.append("%s %d" % [_format_card_name(name1), base1])
	parts.append("%s %d" % [_format_card_name(name2), base2])
	parts.append("%s %d" % [_format_card_name(name3), base3])
	var s: String = " + ".join(parts)
	var bonuses: Array[String] = []
	if bc_bonus > 0:
		bonuses.append("%s +%d" % [_format_card_name(bc_name), bc_bonus])
	if weapon_bonus1 > 0:
		bonuses.append("%s +%d" % [_format_card_name(weapon_name1), weapon_bonus1])
	if weapon_bonus2 > 0:
		bonuses.append("%s +%d" % [_format_card_name(weapon_name2), weapon_bonus2])
	if weapon_bonus3 > 0:
		bonuses.append("%s +%d" % [_format_card_name(weapon_name3), weapon_bonus3])
	var total_loc: int = loc1 + loc2 + loc3
	if total_loc > 0:
		bonuses.append("location +%d" % total_loc)
	if not gametext_bonus_label.is_empty():
		bonuses.append(gametext_bonus_label)
	if not bonuses.is_empty():
		s += " (" + ", ".join(bonuses) + ")"
	s += " = %d" % total
	return s


func _battle_step_show_result() -> void:
	if not is_instance_valid(_battle_reveal_overlay) or not _battle_reveal_overlay.visible:
		return
	if _battle_reveal_index >= _battle_reveal_sequence.size():
		return
	var step: Dictionary = _battle_reveal_sequence[_battle_reveal_index]
	var step_type: String = step.get("type", "paired")
	var light_id: String = step.get("lightCardId", "")
	var dark_id: String = step.get("darkCardId", "")
	var winner: String = step.get("winner", "tie")
	var my_side: String = Connection.get_state().game_side
	var saved_index: int = _battle_reveal_index
	if step_type == "unopposed":
		var char_name: String = ""
		var char_side: String = ""
		if light_id != "":
			char_name = _format_card_name(step.get("lightCardName", light_id))
			char_side = "light"
		else:
			char_name = _format_card_name(step.get("darkCardName", dark_id))
			char_side = "dark"
		var opponent_label: String = "Your" if (char_side != my_side) else "Opponent's"
		var wbw: CenterContainer = _battle_reveal_panel.find_child("WinnerBannerWrap", true, false) as CenterContainer
		if wbw: wbw.visible = true
		var wbp: PanelContainer = _battle_reveal_panel.find_child("WinnerBannerPanel", true, false) as PanelContainer
		if wbp:
			var sty: StyleBoxFlat = wbp.get_theme_stylebox("panel") as StyleBoxFlat
			if sty:
				sty.border_color = Color(0.3, 0.6, 0.9, 0.8) if char_side == "light" else Color(0.8, 0.25, 0.2, 0.8)
		var wb: Label = _battle_reveal_panel.find_child("WinnerBanner", true, false) as Label
		if wb:
			wb.text = "%s is unopposed! %s deck loses 1 card." % [char_name, opponent_label]
			wb.add_theme_color_override("font_color", Color(0.5, 0.8, 1.0, 1) if char_side == "light" else Color(1.0, 0.5, 0.45, 1))
		get_tree().create_timer(2.0).timeout.connect(func() -> void:
			if _battle_reveal_index == saved_index:
				_battle_step_start_mill()
		)
		return
	# --- Paired fight: populate per-column power ---
	var sides_data: Array = [
		{"side": "light", "prefix": "light", "name_key": "lightCardName", "id": light_id},
		{"side": "dark", "prefix": "dark", "name_key": "darkCardName", "id": dark_id}
	]
	for sd in sides_data:
		var col: PanelContainer = _battle_reveal_panel.find_child(str(sd["side"]).capitalize() + "Column", true, false) as PanelContainer
		if not col:
			continue
		var power_val: int = int(step.get(str(sd["prefix"]) + "Power", 0))
		var base_power: int = int(step.get(str(sd["prefix"]) + "BasePower", power_val))
		var loc_bonus: int = int(step.get(str(sd["prefix"]) + "Bonus", 0))
		var wpn_bonus: int = int(step.get(str(sd["prefix"]) + "WeaponBonus", 0))
		var wpn_name: String = step.get(str(sd["prefix"]) + "WeaponName", "")
		var bc_bonus: int = int(step.get(str(sd["prefix"]) + "BattleCardBonus", 0))
		var bc_name: String = step.get(str(sd["prefix"]) + "BattleCardName", "")
		var gt_label: String = step.get(str(sd["prefix"]) + "GametextBonusLabel", "")
		var char_name: String = step.get(str(sd["name_key"]), str(sd["id"]))
		var id2: String = step.get(str(sd["prefix"]) + "CardId2", "")
		var name2: String = step.get(str(sd["prefix"]) + "CardName2", id2)
		var id3: String = step.get(str(sd["prefix"]) + "CardId3", "")
		var name3: String = step.get(str(sd["prefix"]) + "CardName3", id3)
		var display_name: String = _format_card_name(char_name)
		if not id2.is_empty():
			display_name += " + " + _format_card_name(name2)
		if not id3.is_empty():
			display_name += " + " + _format_card_name(name3)
		var cnl: Label = col.find_child("CharNameLabel", true, false) as Label
		if cnl:
			cnl.text = display_name
			cnl.visible = true
		var pw: CenterContainer = col.find_child("PowerWrap", true, false) as CenterContainer
		if pw: pw.visible = true
		var pl: Label = col.find_child("PowerLabel", true, false) as Label
		if pl:
			pl.text = str(power_val)
		var bl: RichTextLabel = col.find_child("BreakdownLabel", true, false) as RichTextLabel
		if bl:
			var parts: Array[String] = []
			parts.append("[color=#c0c0c0]%d[/color] [color=#808080]base[/color]" % base_power)
			if wpn_bonus > 0:
				parts.append("[color=#70e070]+%d[/color] [color=#509050]weapon[/color]" % wpn_bonus)
			if bc_bonus > 0:
				parts.append("[color=#f0d050]+%d[/color] [color=#b09030]battle[/color]" % bc_bonus)
			if loc_bonus > 0:
				parts.append("[color=#80c0f0]+%d[/color] [color=#5090b0]location[/color]" % loc_bonus)
			var dest_arr: Array = step.get(str(sd["prefix"]) + "DestinyDraws", [])
			if dest_arr.size() > 0:
				var dest_sum: int = 0
				for d in dest_arr:
					dest_sum += int(d.get("destiny", 0))
				parts.append("[color=#f0e070]+%d[/color] [color=#b0a040]destiny[/color]" % dest_sum)
			if not gt_label.is_empty():
				parts.append("[color=#d0a0e0]%s[/color]" % gt_label)
			bl.text = "[center]" + " [color=#505060]|[/color] ".join(parts) + "[/center]"
			bl.visible = true
	# Winner banner
	var wbw2: CenterContainer = _battle_reveal_panel.find_child("WinnerBannerWrap", true, false) as CenterContainer
	if wbw2: wbw2.visible = true
	var wbp2: PanelContainer = _battle_reveal_panel.find_child("WinnerBannerPanel", true, false) as PanelContainer
	var wb2: Label = _battle_reveal_panel.find_child("WinnerBanner", true, false) as Label
	if wb2:
		var border_col: Color
		var text_col: Color
		if winner == "light":
			wb2.text = "LIGHT WINS"
			border_col = Color(0.3, 0.6, 0.9, 0.9)
			text_col = Color(0.5, 0.85, 1.0, 1)
		elif winner == "dark":
			wb2.text = "DARK WINS"
			border_col = Color(0.8, 0.25, 0.2, 0.9)
			text_col = Color(1.0, 0.45, 0.35, 1)
		else:
			wb2.text = "TIE — Both Stay"
			border_col = Color(0.85, 0.75, 0.35, 0.8)
			text_col = Color(0.95, 0.85, 0.4, 1)
		wb2.add_theme_color_override("font_color", text_col)
		if wbp2:
			var sty2: StyleBoxFlat = wbp2.get_theme_stylebox("panel") as StyleBoxFlat
			if sty2:
				sty2.border_color = border_col
	# Destiny draws
	var has_destiny: bool = false
	var light_destiny: Array = step.get("lightDestinyDraws", [])
	var dark_destiny: Array = step.get("darkDestinyDraws", [])
	var light_destiny2: Array = step.get("lightDestinyDraws2", [])
	var dark_destiny2: Array = step.get("darkDestinyDraws2", [])
	var light_destiny3: Array = step.get("lightDestinyDraws3", [])
	var dark_destiny3: Array = step.get("darkDestinyDraws3", [])
	var light_battle_destiny: Array = step.get("lightBattleDestinyDraws", [])
	var dark_battle_destiny: Array = step.get("darkBattleDestinyDraws", [])
	if light_destiny.size() > 0 or dark_destiny.size() > 0 or light_destiny2.size() > 0 or dark_destiny2.size() > 0 or light_destiny3.size() > 0 or dark_destiny3.size() > 0 or light_battle_destiny.size() > 0 or dark_battle_destiny.size() > 0:
		has_destiny = true
		_battle_step_show_destiny_draws(step)
	var destiny_delay: float = 0.0
	if has_destiny:
		var total_draws: int = light_destiny.size() + dark_destiny.size() + light_destiny2.size() + dark_destiny2.size() + light_destiny3.size() + dark_destiny3.size() + light_battle_destiny.size() + dark_battle_destiny.size()
		destiny_delay = 1.0 + total_draws * 0.8
	if winner != "tie":
		get_tree().create_timer(2.0 + destiny_delay).timeout.connect(func() -> void:
			if _battle_reveal_index == saved_index:
				_battle_step_animate_loser()
		)
	else:
		get_tree().create_timer(5.0 + destiny_delay).timeout.connect(func() -> void:
			if _battle_reveal_index == saved_index:
				_advance_battle_reveal()
		)


func _battle_step_show_destiny_draws(step: Dictionary) -> void:
	var destiny_section: HBoxContainer = _battle_reveal_panel.find_child("DestinySection", true, false) as HBoxContainer
	if not destiny_section:
		return
	destiny_section.visible = true
	var global_draw_index: int = 0
	for side in ["light", "dark"]:
		var dcol: VBoxContainer = destiny_section.find_child(side.capitalize() + "DestinyCol", true, false) as VBoxContainer
		if not dcol:
			continue
		var dlbl: Label = dcol.find_child("DestinyLabel", true, false) as Label
		var drow: HBoxContainer = dcol.find_child("DestinyCardsRow", true, false) as HBoxContainer
		if not drow:
			continue
		for c in drow.get_children():
			c.queue_free()
		var draws: Array = []
		for arr in [step.get(side + "DestinyDraws", []), step.get(side + "DestinyDraws2", []), step.get(side + "DestinyDraws3", []), step.get(side + "BattleDestinyDraws", [])]:
			draws.append_array(arr)
		if draws.is_empty():
			dcol.visible = false
			continue
		dcol.visible = true
		var total: int = 0
		for d in draws:
			total += int(d.get("destiny", 0))
		if dlbl:
			dlbl.text = "%s Destiny: +%d" % [side.capitalize(), total]
		for d in draws:
			var cid: String = d.get("cardId", "")
			var dval: int = int(d.get("destiny", 0))
			var cw: Control = Control.new()
			cw.custom_minimum_size = Vector2(38, 54)
			cw.clip_contents = false
			cw.modulate = Color(1, 1, 1, 0)
			var tex: TextureRect = TextureRect.new()
			tex.set_anchors_preset(Control.PRESET_FULL_RECT)
			tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
			tex.texture = _load_card_texture_for_id(cid, side)
			cw.add_child(tex)
			var dframe: Panel = Panel.new()
			dframe.set_anchors_preset(Control.PRESET_FULL_RECT)
			dframe.offset_left = -1
			dframe.offset_top = -1
			dframe.offset_right = 1
			dframe.offset_bottom = 1
			dframe.mouse_filter = Control.MOUSE_FILTER_IGNORE
			var dfsb: StyleBoxFlat = StyleBoxFlat.new()
			dfsb.bg_color = Color(0, 0, 0, 0)
			dfsb.border_width_left = 1
			dfsb.border_width_top = 1
			dfsb.border_width_right = 1
			dfsb.border_width_bottom = 1
			dfsb.border_color = Color(0.4, 0.75, 1.0, 0.5) if side == "light" else Color(1.0, 0.4, 0.35, 0.5)
			dfsb.corner_radius_top_left = 2
			dfsb.corner_radius_top_right = 2
			dfsb.corner_radius_bottom_left = 2
			dfsb.corner_radius_bottom_right = 2
			dframe.add_theme_stylebox_override("panel", dfsb)
			cw.add_child(dframe)
			var vlbl: Label = Label.new()
			vlbl.text = "+%d" % dval
			vlbl.add_theme_font_size_override("font_size", 11)
			vlbl.add_theme_color_override("font_color", Color(1.0, 0.95, 0.6, 1.0))
			vlbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			vlbl.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
			vlbl.offset_top = -16
			cw.add_child(vlbl)
			drow.add_child(cw)
			cw.pivot_offset = Vector2(19, 27)
			cw.scale = Vector2(0.5, 0.5)
			var delay: float = global_draw_index * 0.8 + 0.6
			global_draw_index += 1
			var tw: Tween = cw.create_tween()
			tw.set_ease(Tween.EASE_OUT)
			tw.set_trans(Tween.TRANS_BACK)
			tw.tween_interval(delay)
			tw.tween_property(cw, "modulate:a", 1.0, 0.25)
			tw.parallel().tween_property(cw, "scale", Vector2(1.0, 1.0), 0.3)


func _battle_step_animate_loser() -> void:
	if not is_instance_valid(_battle_reveal_overlay) or not _battle_reveal_overlay.visible:
		return
	if _battle_reveal_index >= _battle_reveal_sequence.size():
		return
	var step: Dictionary = _battle_reveal_sequence[_battle_reveal_index]
	var winner: String = step.get("winner", "tie")
	if winner == "tie":
		_battle_step_start_mill()
		return
	var loser_side: String = "dark" if winner == "light" else "light"
	var col: PanelContainer = _battle_reveal_panel.find_child(loser_side.capitalize() + "Column", true, false) as PanelContainer
	if not col:
		_battle_step_start_mill()
		return
	var tween: Tween = col.create_tween()
	tween.set_ease(Tween.EASE_IN)
	tween.set_trans(Tween.TRANS_QUAD)
	tween.tween_property(col, "modulate:a", 0.15, 0.6)
	var saved_index: int = _battle_reveal_index
	get_tree().create_timer(0.3).timeout.connect(func() -> void:
		if _battle_reveal_index == saved_index:
			_battle_step_start_mill()
	)


func _battle_step_start_mill() -> void:
	if not is_instance_valid(_battle_reveal_overlay) or not _battle_reveal_overlay.visible:
		return
	if _battle_reveal_index >= _battle_reveal_sequence.size():
		_advance_battle_reveal()
		return
	var step: Dictionary = _battle_reveal_sequence[_battle_reveal_index]
	var my_side: String = Connection.get_state().game_side
	var light_milled: Array = step.get("lightMilledCardIds", [])
	var dark_milled: Array = step.get("darkMilledCardIds", [])
	_battle_mill_queue = []
	_battle_mill_side = ""
	_battle_mill_index = 0
	if light_milled.size() > 0:
		_battle_mill_queue = light_milled
		_battle_mill_side = "light"
	elif dark_milled.size() > 0:
		_battle_mill_queue = dark_milled
		_battle_mill_side = "dark"
	if _battle_mill_queue.size() == 0:
		var saved_index: int = _battle_reveal_index
		get_tree().create_timer(3.0).timeout.connect(func() -> void:
			if _battle_reveal_index == saved_index:
				_advance_battle_reveal()
		)
		return
	var damage_section: VBoxContainer = _battle_reveal_panel.find_child("BattleRevealDamageSection", true, false) as VBoxContainer
	var damage_label: Label = _battle_reveal_panel.find_child("DamageLabel", true, false) as Label
	if damage_section:
		damage_section.visible = true
	if damage_label:
		var side_label: String = "your" if _battle_mill_side == my_side else "opponent's"
		var count: int = _battle_mill_queue.size()
		damage_label.text = "%d card%s lost from %s deck" % [count, "s" if count != 1 else "", side_label]
	_animate_next_mill_card()


func _animate_next_mill_card() -> void:
	if not is_instance_valid(_battle_reveal_overlay) or not _battle_reveal_overlay.visible:
		return
	if _battle_mill_index >= _battle_mill_queue.size():
		var saved_index: int = _battle_reveal_index
		get_tree().create_timer(3.0).timeout.connect(func() -> void:
			if _battle_reveal_index == saved_index:
				_advance_battle_reveal()
		)
		return
	var card_id: String = _battle_mill_queue[_battle_mill_index]
	_battle_mill_index += 1
	var damage_cards_row: HBoxContainer = _battle_reveal_panel.find_child("DamageCardsRow", true, false) as HBoxContainer
	if not damage_cards_row:
		_advance_battle_reveal()
		return
	var card_wrapper: Control = Control.new()
	card_wrapper.custom_minimum_size = Vector2(50, 72)
	card_wrapper.clip_contents = false
	card_wrapper.modulate = Color(1, 1, 1, 0)
	var tex_rect: TextureRect = TextureRect.new()
	tex_rect.set_anchors_preset(Control.PRESET_TOP_LEFT)
	tex_rect.offset_left = 0
	tex_rect.offset_top = 0
	tex_rect.offset_right = 50
	tex_rect.offset_bottom = 72
	tex_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	tex_rect.texture = _load_card_texture_for_id(card_id, _battle_mill_side)
	card_wrapper.add_child(tex_rect)
	damage_cards_row.add_child(card_wrapper)
	card_wrapper.pivot_offset = Vector2(25, 36)
	card_wrapper.scale = Vector2(0.5, 0.5)
	var tween: Tween = card_wrapper.create_tween()
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_BACK)
	tween.tween_property(card_wrapper, "modulate:a", 1.0, 0.3)
	tween.parallel().tween_property(card_wrapper, "scale", Vector2(1.0, 1.0), 0.35)
	var saved_index: int = _battle_reveal_index
	get_tree().create_timer(1.0).timeout.connect(func() -> void:
		if _battle_reveal_index == saved_index:
			_animate_next_mill_card()
	)


func _format_card_name(name_or_id: String) -> String:
	if name_or_id.is_empty():
		return "—"
	return name_or_id


func _advance_battle_reveal() -> void:
	_battle_reveal_index += 1
	if _battle_reveal_index >= _battle_reveal_sequence.size():
		_battle_reveal_overlay.visible = false
		_battle_reveal_sequence.clear()
		_battle_reveal_index = 0
		_battle_mill_queue.clear()
		_battle_mill_index = 0
		_battle_mill_side = ""
		_refresh()
		if _pending_game_over.size() > 0:
			var won: bool = _pending_game_over.get("won", false)
			var reason_text: String = _pending_game_over.get("reason_text", "")
			_pending_game_over = {}
			_show_game_over_overlay(won, reason_text)
		return
	_show_battle_reveal_step()


func _build_in_play(state: RefCounted) -> void:
	if your_play_container:
		for c in your_play_container.get_children():
			c.queue_free()
	if opp_play_container:
		for c in opp_play_container.get_children():
			c.queue_free()
	var pub: Dictionary = state.game_state.get("publicState", {})
	var my_side: String = state.game_side
	var starting_inst_id: String = pub.get("startingLocationInstanceId", "")
	var my_in_play: Array = pub.get("lightInPlay" if my_side == "light" else "darkInPlay", [])
	var opp_in_play: Array = pub.get("darkInPlay" if my_side == "light" else "lightInPlay", [])
	var opp_side: String = "dark" if my_side == "light" else "light"
	var my_turn_count: int = int(pub.get("lightTurnCount" if my_side == "light" else "darkTurnCount", 0))
	var opp_turn_count: int = int(pub.get("darkTurnCount" if my_side == "light" else "lightTurnCount", 0))
	var phase: String = str(state.game_state.get("phase", ""))
	var turn_side: String = str(state.game_state.get("turnSide", ""))
	var in_declare_or_plan: bool = pub.get("battleCardDeclareSide", "") != "" or pub.get("battlePlanPhase", false)
	var in_battle_plan: bool = pub.get("battlePlanPhase", false)
	var in_battle_card_declare: bool = (pub.get("battleCardDeclareSide", "") != "") and not in_battle_plan
	var starship_battle: bool = bool(pub.get("starshipBattlePhase", false))
	if starship_battle:
		my_in_play = pub.get("lightHyperspace" if my_side == "light" else "darkHyperspace", [])
		opp_in_play = pub.get("darkHyperspace" if my_side == "light" else "lightHyperspace", [])
		starting_inst_id = ""
	var opp_bc_count: int = _opp_battle_card_count(pub, my_side)
	var opp_bc_declared: bool = _opp_battle_cards_declared(pub, my_side)
	if your_play_container:
		if in_battle_plan:
			_build_your_play_battle_plan_order(state, pub, my_in_play, starting_inst_id, my_turn_count)
		else:
			for card in my_in_play:
				if card.get("instanceId", "") == starting_inst_id:
					continue
				if CardCatalog:
					var ty: String = str(CardCatalog.get_card_info(card.get("cardId", ""), my_side, card.get("set", "")).get("type", "")).to_lower()
					if ty == "location":
						continue
					if in_battle_card_declare and ty == "effect":
						continue
				var cp: Control = CardPlaceholderScene.instantiate()
				your_play_container.add_child(cp)
				var face_down: bool = card.get("faceDown", false)
				cp.set_card(card.get("cardId", "?"), card.get("instanceId", ""), my_side, card.get("set", ""), face_down, true)
				_size_board_card(cp, false)
				if cp.has_method("set_action_glow"):
					var glow := _table_ability_glow(card, pub, my_side, phase, turn_side)
					if _picking_duel:
						glow = _duel_pick_glow(card, my_side, my_in_play)
					cp.set_action_glow(glow)
				_animate_in_play_card(cp, my_turn_count, face_down)
				var played_type := ""
				if CardCatalog:
					played_type = str(CardCatalog.get_card_info(card.get("cardId", ""), my_side, card.get("set", "")).get("type", "")).to_lower()
				if face_down and phase == "deploy" and turn_side == my_side and played_type == "character" and cp.has_signal("card_selected"):
					cp.tooltip_text = "Click to return this face-down character to your hand and refund its deploy cost."
					cp.card_selected.connect(_on_my_table_card_clicked)
				elif not face_down and CardCatalog and not in_battle_card_declare:
					var ct: String = str(CardCatalog.get_card_info(card.get("cardId", ""), my_side, card.get("set", "")).get("type", "")).to_lower()
					if ct == "effect" and cp.has_signal("card_selected"):
						cp.card_selected.connect(_on_my_in_play_effect_clicked)
					elif cp.has_signal("card_selected"):
						cp.card_selected.connect(_on_my_table_card_clicked)
			if in_declare_or_plan:
				for inst_id in _declared_battle_cards:
					var card_id: String = ""
					var hand_card_set: String = ""
					for hc in state.hand_with_instances:
						if hc.get("instanceId", "") == inst_id:
							card_id = hc.get("cardId", "")
							hand_card_set = hc.get("set", "")
							break
					if card_id.is_empty():
						continue
					var cp: Control = CardPlaceholderScene.instantiate()
					your_play_container.add_child(cp)
					cp.set_card(card_id, inst_id, my_side, hand_card_set, false, true)
					_size_board_card(cp, false)
	if opp_play_container:
		var opp_face_down: bool = in_battle_plan
		for card in opp_in_play:
			if card.get("instanceId", "") == starting_inst_id:
				continue
			if CardCatalog:
				var oty: String = str(CardCatalog.get_card_info(card.get("cardId", ""), opp_side, card.get("set", "")).get("type", "")).to_lower()
				if oty == "location":
					continue
				if oty == "battle":
					continue
				if in_battle_card_declare and oty == "effect":
					continue
			var cp: Control = CardPlaceholderScene.instantiate()
			opp_play_container.add_child(cp)
			var face_down: bool = opp_face_down or card.get("faceDown", false)
			cp.set_card(card.get("cardId", "?"), card.get("instanceId", ""), opp_side, card.get("set", ""), face_down, false)
			_size_board_card(cp, false)
			_animate_in_play_card(cp, opp_turn_count, face_down)
		if in_declare_or_plan and opp_bc_declared and opp_bc_count > 0:
			for i in range(opp_bc_count):
				var cp: Control = CardPlaceholderScene.instantiate()
				opp_play_container.add_child(cp)
				cp.set_card("", "", opp_side, "", true, false)
				_size_board_card(cp, false)
				_tag_face_down_battle_card(cp)
	_maybe_announce_opp_battle_cards(pub, my_side, in_declare_or_plan, opp_bc_declared)


func _opp_battle_card_count(pub: Dictionary, my_side: String) -> int:
	return int(pub.get("darkBattleCardCount", 0)) if my_side == "light" else int(pub.get("lightBattleCardCount", 0))


func _opp_battle_cards_declared(pub: Dictionary, my_side: String) -> bool:
	var key: String = "darkBattleCardsDeclared" if my_side == "light" else "lightBattleCardsDeclared"
	if pub.has(key):
		return bool(pub.get(key, false))
	if pub.get("battlePlanPhase", false):
		return true
	return _opp_battle_card_count(pub, my_side) > 0


func _opp_battle_card_phrase(pub: Dictionary, my_side: String) -> String:
	if not _opp_battle_cards_declared(pub, my_side):
		return ""
	var n: int = _opp_battle_card_count(pub, my_side)
	if n <= 0:
		return "Opponent played no battle cards."
	if n == 1:
		return "Opponent played 1 battle card."
	return "Opponent played %d battle cards." % n


func _tag_face_down_battle_card(cp: Control) -> void:
	var tag: Label = Label.new()
	tag.text = "BATTLE"
	tag.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tag.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tag.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	tag.add_theme_font_size_override("font_size", 11)
	tag.add_theme_color_override("font_color", Color(0.95, 0.82, 0.25, 1))
	tag.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.95))
	tag.add_theme_constant_override("shadow_offset_x", 1)
	tag.add_theme_constant_override("shadow_offset_y", 1)
	cp.add_child(tag)


func _maybe_announce_opp_battle_cards(pub: Dictionary, my_side: String, in_declare_or_plan: bool, opp_declared: bool) -> void:
	if not in_declare_or_plan:
		_announced_opp_battle_cards = false
		return
	if not opp_declared or _announced_opp_battle_cards:
		return
	var phrase: String = _opp_battle_card_phrase(pub, my_side)
	if phrase.is_empty():
		return
	_announced_opp_battle_cards = true
	_append_chat_line("System", phrase)


func _get_starting_location_card_id(pub: Dictionary, my_in_play: Array, opp_in_play: Array, starting_inst_id: String) -> String:
	if starting_inst_id.is_empty():
		return ""
	for card in my_in_play:
		if card.get("instanceId", "") == starting_inst_id:
			return card.get("cardId", "")
	for card in opp_in_play:
		if card.get("instanceId", "") == starting_inst_id:
			return card.get("cardId", "")
	return ""


func _get_location_bonus_for_character(character_card_id: String, location_card_id: String) -> int:
	if location_card_id.is_empty() or not CardCatalog:
		return 0
	var info: Dictionary = CardCatalog.get_card_info(character_card_id, "")
	if info.get("type", "") != "character":
		return 0
	var b1: int = int(info.get("bonus1", 0))
	var b2: int = int(info.get("bonus2", 0))
	var b3: int = int(info.get("bonus3", 0))
	var loc1: String = str(info.get("bonus1loc", ""))
	var loc2: String = str(info.get("bonus2loc", ""))
	var loc3: String = str(info.get("bonus3loc", ""))
	if loc1 == location_card_id or location_card_id.begins_with(loc1) or loc1.begins_with(location_card_id):
		return b1
	if loc2 == location_card_id or location_card_id.begins_with(loc2) or loc2.begins_with(location_card_id):
		return b2
	if loc3 == location_card_id or location_card_id.begins_with(loc3) or loc3.begins_with(location_card_id):
		return b3
	return 0


func _add_location_bonus_label(cp: Control, card_id: String, location_card_id: String) -> void:
	var bonus: int = _get_location_bonus_for_character(card_id, location_card_id)
	if bonus <= 0:
		return
	var lbl: Label = Label.new()
	lbl.text = "location +%d" % bonus
	lbl.add_theme_font_size_override("font_size", 11)
	lbl.add_theme_color_override("font_color", Color(0.6, 0.9, 0.6, 1))
	cp.add_child(lbl)


func _is_battle_plan_in_play_card(card: Dictionary, my_side: String) -> bool:
	if not CardCatalog:
		return false
	var t: String = str(CardCatalog.get_card_info(card.get("cardId", ""), my_side).get("type", "")).to_lower()
	var pub: Dictionary = Connection.get_state().game_state.get("publicState", {})
	if bool(pub.get("starshipBattlePhase", false)):
		return t == "starship"
	return t == "character" or t == "weapon"


func _build_your_play_battle_plan_order(state: RefCounted, pub: Dictionary, my_in_play: Array, starting_inst_id: String, my_turn_count: int) -> void:
	var my_side: String = state.game_side
	var char_cards: Array = []
	for card in my_in_play:
		if card.get("instanceId", "") == starting_inst_id:
			continue
		if card.get("faceDown", false):
			continue
		if not _is_battle_plan_in_play_card(card, my_side):
			continue
		char_cards.append(card)
	# Drop stale IDs (e.g. effects) so submitted order matches server validation.
	var valid_id_set: Dictionary = {}
	for c in char_cards:
		valid_id_set[c.get("instanceId", "")] = true
	for bc_id in _battle_cards_in_plan:
		valid_id_set[bc_id] = true
	var sanitized: Array = []
	for inst_id in _battle_plan_order:
		if valid_id_set.has(inst_id):
			sanitized.append(inst_id)
	for c in char_cards:
		var iid: String = c.get("instanceId", "")
		if not sanitized.has(iid):
			sanitized.append(iid)
	_battle_plan_order = sanitized
	for bc_id in _battle_cards_in_plan:
		if not _battle_plan_order.has(bc_id):
			_battle_plan_order.append(bc_id)
	var all_known: Dictionary = {}
	for card in char_cards:
		all_known[card.get("instanceId", "")] = card
	for hc in state.hand_with_instances:
		if _battle_cards_in_plan.has(hc.get("instanceId", "")):
			all_known[hc.get("instanceId", "")] = hc
	for inst_id in _battle_plan_order:
		var data: Variant = all_known.get(inst_id)
		if data == null:
			continue
		var card_id: String = data.get("cardId", "")
		if card_id.is_empty():
			continue
		# Use BattlePlanCard (Control + _gui_input) so drag works; CardPlaceholder (Button) blocks drag
		var cp: Control = BattlePlanCardScene.instantiate()
		your_play_container.add_child(cp)
		cp.set_card(card_id, inst_id, my_side)
		_size_board_card(cp, false)
		cp.set_face_down(false)
		_animate_in_play_card(cp, my_turn_count, false)
		if cp.has_signal("drag_started"):
			cp.drag_started.connect(_on_battle_plan_drag_started)
		if cp.has_signal("drag_ended"):
			cp.drag_ended.connect(_on_battle_plan_drag_ended)


func _animate_in_play_card(cp: Control, side_turn_count: int, face_down: bool) -> void:
	# When a side's cards just flipped face up (start of their second turn), play a short reveal animation
	if side_turn_count == 2 and not face_down:
		cp.scale = Vector2(0.3, 1.0)
		var tween: Tween = create_tween()
		tween.tween_property(cp, "scale", Vector2(1.0, 1.0), 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)


func _on_play_card_pressed() -> void:
	if _selected_instance_id.is_empty():
		status_label.text = "Select a card first"
		return
	var g: Dictionary = Connection.get_state().game_state
	var phase: String = g.get("phase", "")
	var turn_side: String = g.get("turnSide", "")
	var my_side: String = Connection.get_state().game_side
	if phase != "deploy" or turn_side != my_side:
		status_label.text = "Not your deploy turn"
		return
	# Hide any card hover popups so they don't stay on screen
	for c in hand_container.get_children():
		if c.has_method("hide_hover_popup"):
			c.hide_hover_popup()
	var my_force: int = int((g.get("light", {}) if my_side == "light" else g.get("dark", {})).get("force", 0))
	var card_id: String = ""
	for entry in Connection.get_state().hand_with_instances:
		if entry.get("instanceId", "") == _selected_instance_id:
			card_id = entry.get("cardId", "")
			break
	if card_id and CardCatalog:
		var card_type: String = CardCatalog.get_card_info(card_id, my_side).get("type", "")
		if card_type == "location":
			if _can_replace_location_with(card_id):
				Connection.get_client().send_message({
					"type": "game_action",
					"action": { "kind": "play_card", "instanceId": _selected_instance_id }
				})
				_selected_instance_id = ""
				_refresh()
				return
			status_label.text = "Location cards cannot be played during deploy"
			return
	var cost: int = 0
	if card_id and CardCatalog:
		cost = int(CardCatalog.get_card_info(card_id, my_side).get("cost", 0))
	if my_force < cost:
		status_label.text = "You don't have enough counters to play this card"
		return
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "play_card", "instanceId": _selected_instance_id }
	})
	_selected_instance_id = ""
	_refresh()


func _on_pass_pressed() -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "pass_phase" }
	})


func _on_battle_pressed() -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "initiate_battle" }
	})


func _on_discard_hand_pressed() -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "discard_hand" }
	})
	_refresh()


func _on_even_up_pressed() -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "even_up" }
	})
	_refresh()


func _on_surrender_planet_pressed() -> void:
	var state: RefCounted = Connection.get_state()
	var pub: Dictionary = state.game_state.get("publicState", {})
	var my_side: String = state.game_side
	var surrender_pending: String = pub.get("surrenderPending", "")
	if surrender_pending == my_side:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": { "kind": "cancel_surrender" }
		})
		_refresh()
		return
	var loc_inst_id: String = pub.get("startingLocationInstanceId", "")
	if loc_inst_id.is_empty():
		status_label.text = "No planet to surrender."
		return
	var planet_name: String = "this planet"
	for c in pub.get("lightInPlay", []) + pub.get("darkInPlay", []):
		if c.get("instanceId", "") == loc_inst_id:
			var card_id: String = c.get("cardId", "")
			if CardCatalog:
				planet_name = CardCatalog.get_card_info(card_id, "").get("planet", "this planet")
			break
	_show_surrender_confirm(planet_name)


func _show_surrender_confirm(planet_name: String) -> void:
	if _evacuation_overlay:
		_evacuation_overlay.queue_free()
		_evacuation_overlay = null
	_evacuation_overlay = CanvasLayer.new()
	_evacuation_overlay.layer = 200
	add_child(_evacuation_overlay)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.05, 0.05, 0.15, 0.85)
	_evacuation_overlay.add_child(bg)
	_evacuation_panel = PanelContainer.new()
	_evacuation_panel.set_anchors_preset(Control.PRESET_CENTER)
	_evacuation_panel.offset_left = -220
	_evacuation_panel.offset_top = -120
	_evacuation_panel.offset_right = 220
	_evacuation_panel.offset_bottom = 120
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.15, 0.1, 0.1, 0.98)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.9, 0.5, 0.3, 0.8)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	_evacuation_panel.add_theme_stylebox_override("panel", style)
	_evacuation_overlay.add_child(_evacuation_panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	_evacuation_panel.add_child(vbox)
	var title := Label.new()
	title.text = "Surrender Planet?"
	title.add_theme_font_size_override("font_size", 16)
	title.add_theme_color_override("font_color", Color(1.0, 0.7, 0.4, 1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)
	var msg := Label.new()
	msg.text = "Are you sure you want to surrender %s?\n\nYour opponent will win control. Your characters and weapons will be stranded there." % planet_name
	msg.add_theme_font_size_override("font_size", 13)
	msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	msg.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(msg)
	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 16)
	vbox.add_child(btn_row)
	var yes_btn := Button.new()
	yes_btn.text = "Yes, Surrender"
	yes_btn.add_theme_font_size_override("font_size", 14)
	yes_btn.pressed.connect(func() -> void:
		Connection.get_client().send_message({
			"type": "game_action",
			"action": { "kind": "surrender_planet" }
		})
		if _evacuation_overlay:
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
		_refresh()
	)
	btn_row.add_child(yes_btn)
	var no_btn := Button.new()
	no_btn.text = "No"
	no_btn.add_theme_font_size_override("font_size", 14)
	no_btn.pressed.connect(func() -> void:
		if _evacuation_overlay:
			_evacuation_overlay.queue_free()
			_evacuation_overlay = null
	)
	btn_row.add_child(no_btn)


func _is_location_card(card_id: String, side: String, card_set: String) -> bool:
	return CardCatalog != null and str(CardCatalog.get_card_info(card_id, side, card_set).get("type", "")).to_lower() == "location"


func _on_discard_location_pressed() -> void:
	if _discard_location_mode:
		_discard_location_mode = false
		if discard_location_btn:
			discard_location_btn.text = "Discard Location"
		var g: Dictionary = Connection.get_state().game_state
		var pub: Dictionary = g.get("publicState", {})
		var my_side: String = Connection.get_state().game_side
		if str(pub.get("surrenderPending", "")) == my_side:
			status_label.text = "Surrendering planet after Even Up."
		else:
			status_label.text = ""
		_build_hand(Connection.get_state())
		return
	var state: RefCounted = Connection.get_state()
	var has_location_in_hand: bool = false
	for entry in state.hand_with_instances:
		if _is_location_card(str(entry.get("cardId", "")), state.game_side, str(entry.get("set", ""))):
			has_location_in_hand = true
			break
	if not has_location_in_hand:
		status_label.text = "You have no location cards in hand to discard."
		return
	_discard_location_mode = true
	if discard_location_btn:
		discard_location_btn.text = "Cancel Discard"
	status_label.text = "Click a highlighted location in your hand to discard it."
	_build_hand(state)


var _concede_layer: CanvasLayer = null
var _turn_banner_side: String = ""
var _turn_banner_layer: CanvasLayer = null


func _maybe_announce_turn(phase: String, turn_side: String, my_side: String, in_play_phase: bool) -> void:
	if not in_play_phase or phase == "choose_next_planet" or _game_over_received:
		return
	if turn_side == _turn_banner_side:
		return
	_turn_banner_side = turn_side
	if turn_side != my_side:
		return
	_show_turn_banner("%s phase" % _phase_display_name(phase))
	if not DisplayServer.window_is_focused():
		DisplayServer.window_request_attention()


func _show_turn_banner(subtitle: String) -> void:
	if _turn_banner_layer and is_instance_valid(_turn_banner_layer):
		_turn_banner_layer.queue_free()
	_turn_banner_layer = CanvasLayer.new()
	_turn_banner_layer.layer = 175
	add_child(_turn_banner_layer)
	var strip := PanelContainer.new()
	strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	strip.anchor_left = 0.0
	strip.anchor_right = 1.0
	strip.anchor_top = 0.38
	strip.anchor_bottom = 0.38
	strip.offset_top = -52
	strip.offset_bottom = 52
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.12, 0.9)
	style.border_color = Color(0.86, 0.72, 0.32, 0.85)
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.shadow_color = Color(0.86, 0.72, 0.32, 0.18)
	style.shadow_size = 22
	strip.add_theme_stylebox_override("panel", style)
	_turn_banner_layer.add_child(strip)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 2)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	strip.add_child(v)
	var title := Label.new()
	title.text = "YOUR TURN"
	title.theme_type_variation = &"TitleLabel"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 40)
	title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.3))
	v.add_child(title)
	var sub := Label.new()
	sub.text = subtitle.to_upper()
	sub.theme_type_variation = &"HeaderLabel"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_font_size_override("font_size", 13)
	sub.add_theme_color_override("font_color", Color(0.72, 0.76, 0.88))
	v.add_child(sub)
	strip.modulate = Color(1, 1, 1, 0)
	var layer := _turn_banner_layer
	var tw := strip.create_tween()
	tw.tween_property(strip, "modulate:a", 1.0, 0.2)
	tw.tween_interval(1.4)
	tw.tween_property(strip, "modulate:a", 0.0, 0.45)
	tw.tween_callback(func() -> void:
		if is_instance_valid(layer):
			layer.queue_free()
	)


## Dimmed full-screen backdrop with a centered navy card; the accent colors the top strip and glow.
func _make_modal(layer_index: int, accent: Color, min_width: float) -> Dictionary:
	var layer := CanvasLayer.new()
	layer.layer = layer_index
	add_child(layer)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.01, 0.02, 0.06, 0.8)
	layer.add_child(bg)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(min_width, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.12, 0.98)
	style.border_color = Color(accent.r, accent.g, accent.b, 0.85)
	style.set_border_width_all(1)
	style.border_width_top = 4
	style.set_corner_radius_all(14)
	style.content_margin_left = 34
	style.content_margin_right = 34
	style.content_margin_top = 26
	style.content_margin_bottom = 28
	style.shadow_color = Color(accent.r, accent.g, accent.b, 0.25)
	style.shadow_size = 28
	panel.add_theme_stylebox_override("panel", style)
	center.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)
	return {"layer": layer, "bg": bg, "panel": panel, "vbox": vbox}


func _close_concede_modal() -> void:
	if _concede_layer and is_instance_valid(_concede_layer):
		_concede_layer.queue_free()
	_concede_layer = null


func _on_concede_pressed() -> void:
	if _concede_layer and is_instance_valid(_concede_layer):
		return
	var m := _make_modal(240, SIDE_COLOR_DARK, 420)
	_concede_layer = m["layer"]
	var bg: ColorRect = m["bg"]
	bg.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			_close_concede_modal()
	)
	var vbox: VBoxContainer = m["vbox"]
	var title := Label.new()
	title.text = "CONCEDE GAME?"
	title.theme_type_variation = &"TitleLabel"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", Color(1.0, 0.5, 0.46))
	vbox.add_child(title)
	var body := Label.new()
	body.text = "Your opponent will be awarded the win.\nThis can't be undone."
	body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.add_theme_font_size_override("font_size", 15)
	body.add_theme_color_override("font_color", Color(0.72, 0.76, 0.88))
	vbox.add_child(body)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 4)
	vbox.add_child(spacer)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	vbox.add_child(row)
	var keep := Button.new()
	keep.text = "Keep Playing"
	_style_action_button(keep, "primary")
	keep.custom_minimum_size = Vector2(170, 44)
	keep.pressed.connect(_close_concede_modal)
	row.add_child(keep)
	var confirm := Button.new()
	confirm.text = "Concede"
	_style_action_button(confirm, "danger")
	confirm.custom_minimum_size = Vector2(170, 44)
	confirm.pressed.connect(func() -> void:
		_close_concede_modal()
		Connection.get_client().game_concede()
	)
	row.add_child(confirm)
	keep.grab_focus.call_deferred()


func _on_return_to_lobby_pressed() -> void:
	Connection.get_client().return_to_lobby(Connection.get_state().game_id)
	_go_to_lobby()


func _on_opp_deck_mouse_entered() -> void:
	_cancel_deck_popup_hide()
	if opp_deck:
		opp_deck.pivot_offset = opp_deck.size / 2
		var tween: Tween = create_tween()
		tween.tween_property(opp_deck, "scale", Vector2(1.25, 1.25), 0.15)
	if opp_deck_count_label:
		opp_deck_count_label.text = str(_opp_deck_count)
		opp_deck_count_label.visible = true
	if _deck_popup_opp and opp_deck_wrapper:
		var tex: TextureRect = _deck_popup_opp.get_meta("card_texture")
		var count_lbl: Label = _deck_popup_opp.get_meta("count_label")
		if tex and opp_deck:
			tex.texture = opp_deck.texture if opp_deck.texture else (CARD_BACK_DARK if Connection.get_state().game_side == "light" else CARD_BACK_LIGHT)
		if count_lbl:
			count_lbl.text = str(_opp_deck_count) + " cards"
		var rect: Rect2 = opp_deck_wrapper.get_global_rect()
		var popup_w: float = _deck_popup_opp.custom_minimum_size.x
		_deck_popup_opp.position = Vector2(rect.position.x + rect.size.x / 2.0 - popup_w / 2.0, rect.position.y + rect.size.y + 8)
		if _deck_popup_yours:
			_deck_popup_yours.visible = false
		_deck_popup_opp.visible = true


func _on_opp_deck_mouse_exited() -> void:
	if opp_deck:
		var tween: Tween = create_tween()
		tween.tween_property(opp_deck, "scale", Vector2(1.0, 1.0), 0.15)
	if opp_deck_count_label:
		opp_deck_count_label.visible = false
	_schedule_deck_popup_hide()


func _on_your_deck_mouse_entered() -> void:
	_cancel_deck_popup_hide()
	if your_deck:
		your_deck.pivot_offset = your_deck.size / 2
		var tween: Tween = create_tween()
		tween.tween_property(your_deck, "scale", Vector2(1.25, 1.25), 0.15)
	if your_deck_count_label:
		your_deck_count_label.text = str(_your_deck_count)
		your_deck_count_label.visible = true
	if _deck_popup_yours and your_deck_wrapper:
		var tex: TextureRect = _deck_popup_yours.get_meta("card_texture")
		var count_lbl: Label = _deck_popup_yours.get_meta("count_label")
		if tex and your_deck:
			tex.texture = your_deck.texture if your_deck.texture else (CARD_BACK_LIGHT if Connection.get_state().game_side == "light" else CARD_BACK_DARK)
		if count_lbl:
			count_lbl.text = str(_your_deck_count) + " cards"
		var rect: Rect2 = your_deck_wrapper.get_global_rect()
		var popup_w: float = _deck_popup_yours.custom_minimum_size.x
		var popup_h: float = _deck_popup_yours.custom_minimum_size.y
		_deck_popup_yours.position = Vector2(rect.position.x + rect.size.x / 2.0 - popup_w / 2.0, rect.position.y - popup_h - 8)
		if _deck_popup_opp:
			_deck_popup_opp.visible = false
		_deck_popup_yours.visible = true


func _on_your_deck_mouse_exited() -> void:
	if your_deck:
		var tween: Tween = create_tween()
		tween.tween_property(your_deck, "scale", Vector2(1.0, 1.0), 0.15)
	if your_deck_count_label:
		your_deck_count_label.visible = false
	_schedule_deck_popup_hide()


func _on_starting_location_chosen(instance_id: String) -> void:
	_animate_card_from_deck_to_slot(instance_id, your_deck, starting_location_slot)
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "choose_starting_location", "instanceId": instance_id }
	})
	_refresh()


func _on_next_planet_chosen(instance_id: String) -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "choose_next_planet", "instanceId": instance_id }
	})
	_refresh()


const CHOICE_LOCATION_SIZE := Vector2(196, 138)
const CHOICE_LOCATION_MIN_W := 150.0
const CHOICE_LOCATION_SEP := 14.0
const SIDE_COLOR_LIGHT := Color(0.35, 0.62, 1.0)
const SIDE_COLOR_DARK := Color(0.95, 0.32, 0.3)
const MAX_FORCE_PIPS := 10


## Location choices shrink to fit the window; if there are still too many,
## the row scrolls sideways (drag the bar or use the mouse wheel).
func _fit_location_choices() -> void:
	if location_choice_cards == null or location_choice_scroll == null:
		return
	var n: int = location_choice_cards.get_child_count()
	if n == 0:
		location_choice_scroll.custom_minimum_size = Vector2.ZERO
		return
	var avail: float = get_viewport_rect().size.x - 140.0
	var fit_w: float = (avail - CHOICE_LOCATION_SEP * (n - 1)) / n
	var w: float = clampf(fit_w, CHOICE_LOCATION_MIN_W, CHOICE_LOCATION_SIZE.x)
	var card_size := Vector2(roundf(w), roundf(w * CHOICE_LOCATION_SIZE.y / CHOICE_LOCATION_SIZE.x))
	for card in location_choice_cards.get_children():
		if card.has_method("set_board_size"):
			card.set_board_size(card_size)
	var content_w: float = card_size.x * n + CHOICE_LOCATION_SEP * (n - 1)
	var overflow: bool = content_w > avail
	location_choice_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_ALWAYS if overflow else ScrollContainer.SCROLL_MODE_DISABLED
	location_choice_scroll.custom_minimum_size = Vector2(minf(content_w, avail), card_size.y + (16.0 if overflow else 0.0))


func _color_destiny_captions(my_side: String) -> void:
	var opp_side: String = "dark" if my_side == "light" else "light"
	for pair in [[your_destiny_caption, "You", my_side], [opp_destiny_caption, "Opponent", opp_side]]:
		var cap: Label = pair[0]
		if cap == null:
			continue
		var side: String = pair[2]
		cap.text = "%s · %s" % [pair[1], "Light" if side == "light" else "Dark"]
		cap.add_theme_color_override("font_color", SIDE_COLOR_LIGHT if side == "light" else SIDE_COLOR_DARK)


# --- Action bar buttons ---

const ACTION_BTN_SIZE := Vector2(200, 44)
const ACTION_KINDS := {
	"primary": {"bg": Color(0.12, 0.17, 0.38), "edge": Color(0.95, 0.78, 0.32), "font": Color(1.0, 0.95, 0.78)},
	"secondary": {"bg": Color(0.06, 0.1, 0.22), "edge": Color(0.32, 0.55, 0.9), "font": Color(0.88, 0.93, 1.0)},
	"danger": {"bg": Color(0.2, 0.05, 0.07), "edge": Color(0.92, 0.32, 0.3), "font": Color(1.0, 0.84, 0.82)},
}
var _heading_font: Font = null


func _action_box(bg: Color, edge: Color, state: String) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.set_corner_radius_all(9)
	s.set_border_width_all(1)
	s.content_margin_left = 16
	s.content_margin_right = 16
	s.content_margin_top = 10
	s.content_margin_bottom = 10
	match state:
		"hover":
			s.bg_color = bg.lightened(0.12)
			s.border_color = edge.lightened(0.15)
			s.border_width_bottom = 4
			s.shadow_color = Color(edge.r, edge.g, edge.b, 0.35)
			s.shadow_size = 10
		"pressed":
			s.bg_color = bg.darkened(0.2)
			s.border_color = edge.darkened(0.1)
			s.border_width_top = 2
			s.content_margin_top = 12
			s.content_margin_bottom = 8
		"disabled":
			s.bg_color = Color(bg.r, bg.g, bg.b, 0.45)
			s.border_color = Color(edge.r, edge.g, edge.b, 0.3)
			s.border_width_bottom = 3
		_:
			s.bg_color = bg
			s.border_color = edge
			s.border_width_bottom = 4
			s.shadow_color = Color(edge.r, edge.g, edge.b, 0.18)
			s.shadow_size = 6
	s.border_blend = false
	return s


func _style_overlay_child(n: Node) -> void:
	if not n is Button:
		return
	var b := n as Button
	var t := b.text.to_lower()
	var kind := "primary"
	if t.contains("skip") or t.contains("cancel") or t.contains("keep") or t.contains("decline") or t.contains("back") or t.begins_with("no"):
		kind = "secondary"
	_style_action_button(b, kind)


func _style_action_button(btn: Button, kind: String) -> void:
	if btn == null or str(btn.get_meta("action_kind", "")) == kind:
		return
	btn.set_meta("action_kind", kind)
	var k: Dictionary = ACTION_KINDS[kind]
	btn.theme_type_variation = &""
	btn.custom_minimum_size = ACTION_BTN_SIZE
	for state in ["normal", "hover", "pressed", "disabled"]:
		btn.add_theme_stylebox_override(state, _action_box(k["bg"], k["edge"], state))
	btn.add_theme_stylebox_override("hover_pressed", _action_box(k["bg"], k["edge"], "pressed"))
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	btn.add_theme_color_override("font_color", k["font"])
	btn.add_theme_color_override("font_hover_color", Color(1, 1, 1))
	btn.add_theme_color_override("font_focus_color", k["font"])
	btn.add_theme_color_override("font_pressed_color", k["font"].darkened(0.1))
	btn.add_theme_color_override("font_hover_pressed_color", k["font"])
	if _heading_font == null:
		_heading_font = load("res://fonts/Orbitron.ttf") as Font
	if _heading_font:
		btn.add_theme_font_override("font", _heading_font)
	btn.add_theme_font_size_override("font_size", 13)


func _style_action_buttons() -> void:
	if actions_right == null:
		return
	for c in actions_right.get_children():
		if not c is Button:
			continue
		var b := c as Button
		var kind := "secondary"
		if b == surrender_planet_btn:
			kind = "danger"
		elif b.theme_type_variation == &"PrimaryButton":
			kind = "primary"
		_style_action_button(b, kind)


## Speech-bubble icon for the chat toggle.
static func _make_chat_icon(tint: Color) -> ImageTexture:
	var sz := 18
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var edge := Color(tint.r, tint.g, tint.b, 0.95)
	var fill := Color(tint.r * 0.35, tint.g * 0.35, tint.b * 0.35, 0.6)
	for y in range(2, 13):
		for x in range(1, 17):
			var corner: bool = (x < 3 or x > 14) and (y < 4 or y > 11)
			if corner:
				continue
			var is_edge: bool = y == 2 or y == 12 or x == 1 or x == 16
			img.set_pixel(x, y, edge if is_edge else fill)
	for i in range(4):
		for x in range(4, 8 - i):
			img.set_pixel(x, 13 + i, edge)
	for x in [5, 9, 13]:
		img.set_pixel(x - 1, 7, edge)
		img.set_pixel(x, 7, edge)
	return ImageTexture.create_from_image(img)


var _chat_badge: PanelContainer = null
var _chat_badge_label: Label = null


func _setup_chat_toggle() -> void:
	if chat_toggle_btn == null:
		return
	chat_toggle_btn.icon = _make_chat_icon(Color(0.6, 0.78, 1.0))
	chat_toggle_btn.add_theme_constant_override("h_separation", 6)
	chat_toggle_btn.custom_minimum_size = Vector2(96, 34)
	concede_btn.custom_minimum_size = Vector2(0, 34)
	_chat_badge = PanelContainer.new()
	_chat_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.95, 0.78, 0.32)
	s.set_corner_radius_all(9)
	s.content_margin_left = 5
	s.content_margin_right = 5
	s.content_margin_top = 0
	s.content_margin_bottom = 0
	_chat_badge.add_theme_stylebox_override("panel", s)
	_chat_badge.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_chat_badge.offset_left = -12
	_chat_badge.offset_top = -7
	_chat_badge.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_chat_badge_label = Label.new()
	_chat_badge_label.add_theme_font_size_override("font_size", 11)
	_chat_badge_label.add_theme_color_override("font_color", Color(0.08, 0.06, 0.02))
	_chat_badge_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_chat_badge.add_child(_chat_badge_label)
	_chat_badge.visible = false
	chat_toggle_btn.add_child(_chat_badge)

var _plates: Dictionary = {}


func _build_info_plates() -> void:
	_plates["opp"] = _make_info_plate()
	_plates["you"] = _make_info_plate()
	if opp_corner:
		opp_corner.add_child(_plates["opp"]["panel"])
		opp_corner.move_child(_plates["opp"]["panel"], 0)
	if your_corner:
		your_corner.add_child(_plates["you"]["panel"])
		your_corner.move_child(_plates["you"]["panel"], 0)


func _make_info_plate() -> Dictionary:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(176, 0)
	panel.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.12, 0.88)
	style.set_border_width_all(1)
	style.border_width_left = 3
	style.border_color = Color(0.18, 0.38, 0.65, 0.8)
	style.set_corner_radius_all(8)
	style.content_margin_left = 10
	style.content_margin_right = 10
	style.content_margin_top = 6
	style.content_margin_bottom = 7
	panel.add_theme_stylebox_override("panel", style)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 3)
	vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(vbox)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 8)
	vbox.add_child(top)
	var name_label := Label.new()
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.clip_text = true
	name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name_label.add_theme_font_size_override("font_size", 14)
	name_label.add_theme_color_override("font_color", Color(0.94, 0.95, 1.0))
	top.add_child(name_label)
	var side_tag := Label.new()
	side_tag.theme_type_variation = &"HeaderLabel"
	side_tag.add_theme_font_size_override("font_size", 9)
	side_tag.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	top.add_child(side_tag)

	var stats := Label.new()
	stats.add_theme_font_size_override("font_size", 11)
	stats.add_theme_color_override("font_color", Color(0.66, 0.72, 0.86))
	vbox.add_child(stats)

	var force_row := HBoxContainer.new()
	force_row.add_theme_constant_override("separation", 6)
	vbox.add_child(force_row)
	var force_caption := Label.new()
	force_caption.text = "Force"
	force_caption.add_theme_font_size_override("font_size", 11)
	force_caption.add_theme_color_override("font_color", Color(0.66, 0.72, 0.86))
	force_row.add_child(force_caption)
	var pips := HBoxContainer.new()
	pips.add_theme_constant_override("separation", 3)
	pips.alignment = BoxContainer.ALIGNMENT_BEGIN
	pips.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	force_row.add_child(pips)
	var extra := Label.new()
	extra.add_theme_font_size_override("font_size", 11)
	extra.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	force_row.add_child(extra)

	return {
		"panel": panel, "style": style, "name": name_label, "side": side_tag,
		"stats": stats, "pips": pips, "extra": extra, "force_row": force_row, "last_force": -1,
	}


func _make_force_pip() -> Panel:
	var pip := Panel.new()
	pip.custom_minimum_size = Vector2(9, 9)
	pip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var s := StyleBoxFlat.new()
	s.bg_color = Color(1.0, 0.84, 0.36)
	s.set_corner_radius_all(5)
	s.shadow_color = Color(1.0, 0.72, 0.18, 0.55)
	s.shadow_size = 3
	pip.add_theme_stylebox_override("panel", s)
	return pip


func _update_info_plate(key: String, player_name: String, side: String, info: Dictionary, planets_won: int, active: bool, deploy: bool) -> void:
	if not _plates.has(key):
		return
	var p: Dictionary = _plates[key]
	var side_color: Color = SIDE_COLOR_LIGHT if side == "light" else SIDE_COLOR_DARK
	(p["name"] as Label).text = player_name if not player_name.is_empty() else ("You" if key == "you" else "Opponent")
	var tag := p["side"] as Label
	tag.text = "LIGHT" if side == "light" else "DARK"
	tag.add_theme_color_override("font_color", side_color)
	(p["stats"] as Label).text = "Hand %d   ·   Planets %d" % [int(info.get("handCount", 0)), planets_won]
	var style := p["style"] as StyleBoxFlat
	if active:
		style.border_color = Color(0.86, 0.72, 0.32, 0.95)
		style.shadow_color = Color(0.86, 0.72, 0.32, 0.25)
		style.shadow_size = 8
	else:
		style.border_color = Color(side_color.r, side_color.g, side_color.b, 0.55)
		style.shadow_size = 0
	var force: int = int(info.get("force", 0))
	if int(p["last_force"]) != force:
		p["last_force"] = force
		var pips := p["pips"] as HBoxContainer
		for c in pips.get_children():
			c.queue_free()
		for i in range(mini(force, MAX_FORCE_PIPS)):
			pips.add_child(_make_force_pip())
		var extra := p["extra"] as Label
		if force <= 0:
			extra.text = "0"
		elif force > MAX_FORCE_PIPS:
			extra.text = "+%d" % (force - MAX_FORCE_PIPS)
		else:
			extra.text = ""
	(p["force_row"] as Control).modulate.a = 1.0 if deploy else 0.5


var _board_character_size := Vector2(72, 100)
var _board_location_size := Vector2(136, 96)
var _fitting_board: bool = false


func _size_board_card(cp: Control, is_location: bool) -> void:
	var size := _board_location_size if is_location else _board_character_size
	if cp.has_method("set_board_size"):
		cp.set_board_size(size)
	else:
		cp.custom_minimum_size = size


## The lanes, both hyperspace piles, and the location stay on screen together.
## Nothing in the main board scrolls up and down.
func _fit_board_to_window() -> void:
	if _fitting_board:
		return
	var vbox: Control = get_node_or_null("HBoxContainer/Margin/GameArea/VBox") as Control
	var table: Control = get_node_or_null("HBoxContainer/Margin/GameArea/VBox/TableSection") as Control
	if table == null:
		var wrapped: Node = get_node_or_null("HBoxContainer/Margin/GameArea/VBox/TableScroll/TableSection")
		table = wrapped as Control
	if vbox == null or table == null or vbox.size.y < 200:
		return
	if table.get_parent() != null and str(table.get_parent().name) == "TableScroll":
		var scroll: Node = table.get_parent()
		var idx: int = scroll.get_index()
		scroll.remove_child(table)
		vbox.add_child(table)
		vbox.move_child(table, idx)
		scroll.queue_free()
	_fitting_board = true
	var reserved := 0.0
	var visible_count := 0
	for child in vbox.get_children():
		if not child is Control:
			continue
		var row := child as Control
		if not row.visible:
			continue
		visible_count += 1
		if row == table:
			continue
		reserved += row.get_combined_minimum_size().y
	var sep := vbox.get_theme_constant("separation")
	if visible_count > 1:
		reserved += sep * (visible_count - 1)
	var table_h := int(vbox.size.y - reserved)
	var table_sep := 4
	if table is BoxContainer:
		table_sep = (table as BoxContainer).get_theme_constant("separation")
	# Gaps between the two lanes, the location, and the spacers, plus the label under the location art.
	table_h -= table_sep * 4 + 6
	var label_h := 22
	var loc_card_h := 96
	var loc_block := label_h + loc_card_h
	var band := 100
	if table_h > loc_block + 80:
		band = int((table_h - loc_block) / 2.0)
	else:
		loc_card_h = max(64, int((table_h - 80) * 0.34))
		loc_block = label_h + loc_card_h
		band = max(64, int((table_h - loc_block) / 2.0))
	band = clampi(band, 64, 150)
	if band * 2 + loc_block > table_h and table_h > 160:
		band = int((table_h - loc_block) / 2.0)
		band = max(64, band)
	var loc_spare: int = table_h - band * 2 - loc_block
	if loc_spare > 0:
		loc_card_h += mini(loc_spare, 24)
	_board_character_size = Vector2(maxi(52, int(float(band - 8) * 96.0 / 136.0)), band - 8)
	_board_location_size = Vector2(maxi(96, int(float(loc_card_h) * 136.0 / 96.0)), loc_card_h)
	var opp_band: Control = table.get_node_or_null("OpponentPlayBand") as Control
	var your_band: Control = table.get_node_or_null("YourPlayBand") as Control
	if opp_band:
		opp_band.custom_minimum_size.y = band
	if your_band:
		your_band.custom_minimum_size.y = band
	if starting_location_slot:
		starting_location_slot.custom_minimum_size = _board_location_size
	for container in [your_play_container, opp_play_container]:
		if container == null:
			continue
		for card in container.get_children():
			if card is Control:
				_size_board_card(card as Control, false)
	if starting_location_slot:
		for card in starting_location_slot.get_children():
			if card is Control:
				_size_board_card(card as Control, true)
	_fit_location_choices()
	_fitting_board = false


func _lift_setup_banners() -> void:
	if destiny_compare_section == null or location_choice_section == null:
		return
	var layer := CanvasLayer.new()
	layer.layer = 30
	add_child(layer)
	var anchor := CenterContainer.new()
	anchor.set_anchors_preset(Control.PRESET_FULL_RECT)
	anchor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(anchor)
	var box := VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	anchor.add_child(box)
	for section in [destiny_compare_section, location_choice_section]:
		var section_node := section as Control
		section_node.visible = false
		section_node.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var parent := section_node.get_parent()
		if parent:
			parent.remove_child(section_node)
		box.add_child(section_node)


func _fly_layer() -> CanvasLayer:
	if _setup_fly_layer == null or not is_instance_valid(_setup_fly_layer):
		_setup_fly_layer = CanvasLayer.new()
		_setup_fly_layer.layer = 46
		add_child(_setup_fly_layer)
	return _setup_fly_layer


func _animate_destiny_cards_from_decks(opp_card_id: String, your_card_id: String, opp_side: String) -> void:
	var my_side: String = Connection.get_state().game_side
	_destiny_flying = true
	await get_tree().process_frame
	var flying_opp: Control = null
	var flying_yours: Control = null
	var layer := _fly_layer()
	if opp_card_id and opp_deck:
		flying_opp = CardPlaceholderScene.instantiate()
		layer.add_child(flying_opp)
		flying_opp.set_card(opp_card_id, "", opp_side)
		flying_opp.global_position = opp_deck.get_global_rect().position + (opp_deck.get_global_rect().size - flying_opp.custom_minimum_size) / 2
	if your_card_id and your_deck:
		flying_yours = CardPlaceholderScene.instantiate()
		layer.add_child(flying_yours)
		flying_yours.set_card(your_card_id, "", my_side)
		flying_yours.global_position = your_deck.get_global_rect().position + (your_deck.get_global_rect().size - flying_yours.custom_minimum_size) / 2
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_CUBIC)
	if flying_opp:
		var slot_rect: Rect2 = opponent_destiny_slot.get_global_rect()
		var end_pos: Vector2 = slot_rect.position + (slot_rect.size - flying_opp.custom_minimum_size) / 2
		tween.tween_property(flying_opp, "global_position", end_pos, 0.5)
	if flying_yours:
		var slot_rect: Rect2 = your_destiny_slot.get_global_rect()
		var end_pos: Vector2 = slot_rect.position + (slot_rect.size - flying_yours.custom_minimum_size) / 2
		tween.tween_property(flying_yours, "global_position", end_pos, 0.5)
	tween.tween_callback(func() -> void:
		_destiny_flying = false
		if flying_opp:
			var cp: Control = CardPlaceholderScene.instantiate()
			opponent_destiny_slot.add_child(cp)
			cp.set_card(opp_card_id, "", opp_side)
			flying_opp.queue_free()
		if flying_yours:
			var cp: Control = CardPlaceholderScene.instantiate()
			your_destiny_slot.add_child(cp)
			cp.set_card(your_card_id, "", my_side)
			flying_yours.queue_free()
	)


func _animate_initial_draw(state: RefCounted, hand_entries: Array) -> void:
	if not your_deck or not hand_container:
		_build_hand(state)
		return
	for c in hand_container.get_children():
		c.queue_free()
	var my_side: String = state.game_side
	var deck_rect: Rect2 = your_deck.get_global_rect()
	var hand_rect: Rect2 = hand_container.get_global_rect()
	if hand_container.get_parent():
		hand_rect = hand_container.get_parent().get_global_rect()
	var flying_cards: Array = []
	var layer := _fly_layer()
	for i in range(hand_entries.size()):
		var entry: Dictionary = hand_entries[i]
		var card_id: String = entry.get("cardId", "")
		var inst_id: String = entry.get("instanceId", "")
		if card_id.is_empty():
			continue
		var flying: Control = CardPlaceholderScene.instantiate()
		layer.add_child(flying)
		flying.set_card(card_id, inst_id, my_side)
		var card_size: Vector2 = flying.custom_minimum_size
		flying.global_position = deck_rect.position + (deck_rect.size - card_size) / 2
		flying_cards.append(flying)
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_CUBIC)
	for i in range(flying_cards.size()):
		var flying: Control = flying_cards[i]
		var card_size: Vector2 = flying.custom_minimum_size
		var nx: float = hand_rect.position.x + (i % 6) * (card_size.x * 0.5 + 6)
		var ny: float = hand_rect.position.y + (hand_rect.size.y - card_size.y) / 2
		var end_pos: Vector2 = Vector2(nx, ny)
		tween.tween_property(flying, "global_position", end_pos, 0.45).set_delay(i * 0.08)
	tween.chain().tween_callback(func() -> void:
		for c in flying_cards:
			if is_instance_valid(c):
				c.queue_free()
		_build_hand(state)
	)


func _animate_card_from_deck_to_slot(instance_id: String, from_deck: Control, to_slot: Control) -> void:
	if not from_deck or not to_slot:
		return
	var pub: Dictionary = Connection.get_state().game_state.get("publicState", {})
	var choices: Array = pub.get("startingLocationChoices", [])
	var card_id: String = ""
	var my_side: String = Connection.get_state().game_side
	for c in choices:
		if c.get("instanceId", "") == instance_id:
			card_id = c.get("cardId", "")
			break
	if card_id.is_empty():
		return
	var flying: Control = CardPlaceholderScene.instantiate()
	_fly_layer().add_child(flying)
	flying.set_card(card_id, "", my_side)
	var card_size: Vector2 = flying.custom_minimum_size
	var deck_rect: Rect2 = from_deck.get_global_rect()
	var slot_rect: Rect2 = to_slot.get_global_rect()
	flying.global_position = deck_rect.position + (deck_rect.size - card_size) / 2
	var end_pos: Vector2 = slot_rect.position + (slot_rect.size - card_size) / 2
	var tween: Tween = create_tween()
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_CUBIC)
	tween.tween_property(flying, "global_position", end_pos, 0.55)
	tween.tween_callback(flying.queue_free)
