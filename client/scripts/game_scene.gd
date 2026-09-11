## In-game scene: hand, table (in-play), phase/turn, play card / pass / battle.
## Player always at bottom (your deck + hand + in play), opponent at top (their deck + in play).
extends Control

const CardPlaceholderScene = preload("res://scenes/card_placeholder.tscn")
const BattlePlanCardScene = preload("res://scenes/battle_plan_card.tscn")
const CARD_BACK_LIGHT = preload("res://assets/card_back_light.png")
const CARD_BACK_DARK = preload("res://assets/card_back_dark.png")

@onready var phase_label: Label = $HBoxContainer/Margin/GameArea/VBox/PhaseLabel
@onready var opp_discard_wrapper: Control = $HBoxContainer/Margin/GameArea/VBox/OpponentSection/OpponentDiscard/OppDiscardWrapper
@onready var opp_discard: TextureRect = $HBoxContainer/Margin/GameArea/VBox/OpponentSection/OpponentDiscard/OppDiscardWrapper/OppDiscard
@onready var opp_discard_label: Label = $HBoxContainer/Margin/GameArea/VBox/OpponentSection/OpponentDiscard/OppDiscardLabel
@onready var opp_deck_wrapper: Control = $HBoxContainer/Margin/GameArea/VBox/OpponentSection/OpponentLeft/OppDeckWrapper
@onready var opp_deck: TextureRect = $HBoxContainer/Margin/GameArea/VBox/OpponentSection/OpponentLeft/OppDeckWrapper/OppDeck
@onready var opp_deck_count_label: Label = $HBoxContainer/Margin/GameArea/VBox/OpponentSection/OpponentLeft/OppDeckWrapper/OppDeckCount
@onready var your_discard_wrapper: Control = $HBoxContainer/Margin/GameArea/VBox/BottomBar/YourDiscard/YourDiscardPileWrapper
@onready var your_discard: TextureRect = $HBoxContainer/Margin/GameArea/VBox/BottomBar/YourDiscard/YourDiscardPileWrapper/YourDiscardPile
@onready var your_discard_label: Label = $HBoxContainer/Margin/GameArea/VBox/BottomBar/YourDiscard/YourDiscardLabel
@onready var your_deck_wrapper: Control = $HBoxContainer/Margin/GameArea/VBox/BottomBar/DeckLeft/YourDeckWrapper
@onready var your_deck: TextureRect = $HBoxContainer/Margin/GameArea/VBox/BottomBar/DeckLeft/YourDeckWrapper/YourDeck
@onready var your_deck_count_label: Label = $HBoxContainer/Margin/GameArea/VBox/BottomBar/DeckLeft/YourDeckWrapper/YourDeckCount
@onready var hand_label: Label = $HBoxContainer/Margin/GameArea/VBox/BottomBar/HandCenter/HandLabel
@onready var hand_container: HBoxContainer = $HBoxContainer/Margin/GameArea/VBox/BottomBar/HandCenter/Scroll/HandList
@onready var your_play_container: HBoxContainer = $HBoxContainer/Margin/GameArea/VBox/TableSection/YourInPlayScroll/YourInPlayCenter/YourInPlayRow
@onready var opp_play_container: HBoxContainer = $HBoxContainer/Margin/GameArea/VBox/TableSection/OpponentInPlayScroll/OpponentInPlayCenter/OpponentInPlayRow
@onready var opponent_battle_cards_label: Label = $HBoxContainer/Margin/GameArea/VBox/TableSection/OpponentBattleCardsLabel
@onready var play_card_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/PlayCardBtn
@onready var pass_phase_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/PassPhaseBtn
@onready var battle_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/BattleBtn
@onready var discard_hand_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/DiscardHandBtn
@onready var even_up_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/EvenUpBtn
@onready var discard_location_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/DiscardLocationBtn
@onready var evacuate_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/EvacuateBtn
@onready var surrender_planet_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/SurrenderPlanetBtn
@onready var concede_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/ConcedeBtn
@onready var return_to_lobby_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BottomBar/ActionsRight/ReturnToLobbyBtn
@onready var status_label: Label = $HBoxContainer/Margin/GameArea/VBox/StatusLabel
@onready var destiny_compare_section: VBoxContainer = $HBoxContainer/Margin/GameArea/VBox/DestinyCompareSection
@onready var destiny_compare_label: Label = $HBoxContainer/Margin/GameArea/VBox/DestinyCompareSection/DestinyCompareLabel
@onready var opponent_destiny_slot: HBoxContainer = $HBoxContainer/Margin/GameArea/VBox/DestinyCompareSection/OpponentDestinySlot
@onready var your_destiny_slot: HBoxContainer = $HBoxContainer/Margin/GameArea/VBox/DestinyCompareSection/YourDestinySlot
@onready var location_row: Control = $HBoxContainer/Margin/GameArea/VBox/TableSection/LocationRow
@onready var starting_location_label: Label = $HBoxContainer/Margin/GameArea/VBox/TableSection/LocationRow/LocationVBox/StartingLocationLabel
@onready var starting_location_slot: CenterContainer = $HBoxContainer/Margin/GameArea/VBox/TableSection/LocationRow/LocationVBox/StartingLocationSlot
@onready var location_choice_section: VBoxContainer = $HBoxContainer/Margin/GameArea/VBox/LocationChoiceSection
@onready var location_choice_label: Label = $HBoxContainer/Margin/GameArea/VBox/LocationChoiceSection/LocationChoiceLabel
@onready var location_choice_cards: HBoxContainer = $HBoxContainer/Margin/GameArea/VBox/LocationChoiceSection/LocationChoiceCards
@onready var battle_plan_section: VBoxContainer = $HBoxContainer/Margin/GameArea/VBox/BattlePlanSection
@onready var battle_plan_label: Label = $HBoxContainer/Margin/GameArea/VBox/BattlePlanSection/BattlePlanLabel
@onready var battle_plan_row: HBoxContainer = $HBoxContainer/Margin/GameArea/VBox/BattlePlanSection/BattlePlanRow
@onready var battle_plan_ready_btn: Button = $HBoxContainer/Margin/GameArea/VBox/BattlePlanSection/BattlePlanReadyBtn
@onready var opponent_hand_container: HBoxContainer = $HBoxContainer/Margin/GameArea/VBox/OpponentSection/OpponentHandContainer
@onready var opp_force_label: Label = $HBoxContainer/Margin/GameArea/VBox/OpponentSection/OpponentLeft/OpponentForceLabel
@onready var your_force_label: Label = $HBoxContainer/Margin/GameArea/VBox/BottomBar/DeckLeft/YourForceLabel
@onready var chat_messages: VBoxContainer = $HBoxContainer/ChatPanel/Margin/VBox/ChatScroll/Messages
@onready var chat_input: LineEdit = $HBoxContainer/ChatPanel/Margin/VBox/ChatInputRow/ChatInput
@onready var chat_send_btn: Button = $HBoxContainer/ChatPanel/Margin/VBox/ChatInputRow/ChatSendBtn

var _selected_instance_id: String = ""
var _discard_location_mode: bool = false
var _destiny_animation_done: bool = false
var _previous_phase: String = ""
var _initial_draw_animation_done: bool = false
var _your_deck_count: int = 0
var _opp_deck_count: int = 0

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


func _ready() -> void:
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
	if surrender_planet_btn:
		surrender_planet_btn.pressed.connect(_on_surrender_planet_pressed)
	concede_btn.pressed.connect(_on_concede_pressed)
	if return_to_lobby_btn:
		return_to_lobby_btn.pressed.connect(_on_return_to_lobby_pressed)
	_ensure_effect_decline_btn()
	if battle_plan_ready_btn:
		battle_plan_ready_btn.pressed.connect(_on_battle_plan_ready_pressed)
	if chat_send_btn:
		chat_send_btn.pressed.connect(_on_chat_send)
	if chat_input:
		chat_input.text_submitted.connect(_on_chat_submitted)
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
	style.bg_color = Color(0.1, 0.12, 0.18, 0.85)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.border_color = Color(0.3, 0.4, 0.6, 0.7)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	style.set_content_margin_all(6)
	_controlled_planets_panel.add_theme_stylebox_override("panel", style)
	_controlled_planets_panel.position = Vector2(4, 4)
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
	_stranded_popup_panel.offset_left = -250
	_stranded_popup_panel.offset_top = -200
	_stranded_popup_panel.offset_right = 250
	_stranded_popup_panel.offset_bottom = 200
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
	for planet_data in planets:
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
				_show_stranded_cards(pd)
		)
		vbox.add_child(wrapper)


func _show_stranded_cards(planet_data: Dictionary) -> void:
	if not _stranded_popup_layer or not _stranded_popup_panel:
		return
	var content: VBoxContainer = _stranded_popup_panel.find_child("StrandedContent", true, false) as VBoxContainer
	if not content:
		return
	for c in content.get_children():
		c.queue_free()
	var planet_name: String = planet_data.get("planet", "Unknown")
	var winner: String = planet_data.get("controlledBy", "")
	var loc_card_id: String = planet_data.get("locationCardId", "")
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
			var card_tex := TextureRect.new()
			card_tex.custom_minimum_size = Vector2(60, 86)
			card_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			card_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			var face_down: bool = card_data.get("faceDown", false)
			card_tex.texture = (CARD_BACK_LIGHT if side_str == "light" else CARD_BACK_DARK) if face_down else _load_card_texture_for_id(card_id, side_str)
			cards_row.add_child(card_tex)
	var close_label := Label.new()
	close_label.text = "(click outside to close)"
	close_label.add_theme_font_size_override("font_size", 11)
	close_label.add_theme_color_override("font_color", Color(0.6, 0.6, 0.7, 0.8))
	close_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(close_label)
	_stranded_popup_layer.visible = true


# ---------------------------------------------------------------------------
# Evacuation UI
# ---------------------------------------------------------------------------

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
			var has_transport: bool = _has_transport_in_hand(state)
			var evacuatable: Array = _get_evacuatable_planet_info(pub, my_side)
			evacuate_btn.visible = has_transport and evacuatable.size() > 0
		else:
			evacuate_btn.visible = false
	# Show interception prompt to opponent
	if evac_state.size() > 0 and evac_state.get("awaitingInterception", false):
		var evac_side: String = evac_state.get("evacuatingSide", "")
		if evac_side == my_side:
			status_label.text = "Evacuating... waiting for opponent to respond."
		else:
			_show_interception_prompt(state, evac_state)
	elif evac_result.size() > 0:
		if not evac_result.get("intercepted", false) and evac_result.get("outcome", "") == "success":
			_show_transport_complete_then_dismiss(evac_result, my_side)
		else:
			_show_evacuation_result(evac_result, my_side)


func _on_evacuate_pressed() -> void:
	var state: RefCounted = Connection.get_state()
	var pub: Dictionary = state.game_state.get("publicState", {})
	var my_side: String = state.game_side
	var transports: Array = _get_transport_cards_in_hand(state)
	var planets: Array = _get_evacuatable_planet_info(pub, my_side)
	if transports.is_empty() or planets.is_empty():
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
	title.text = "Evacuation — Select Transport & Planet"
	title.add_theme_font_size_override("font_size", 16)
	title.add_theme_color_override("font_color", Color(0.9, 0.85, 0.4, 1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)
	# Transport selection — card images
	var transport_label := Label.new()
	transport_label.text = "Select Transport Ship:"
	transport_label.add_theme_font_size_override("font_size", 13)
	vbox.add_child(transport_label)
	var transport_row := HBoxContainer.new()
	transport_row.alignment = BoxContainer.ALIGNMENT_CENTER
	transport_row.add_theme_constant_override("separation", 10)
	vbox.add_child(transport_row)
	var selected_transport: Dictionary = transports[0]
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
	confirm_btn.add_theme_font_size_override("font_size", 14)
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
	cancel_btn.add_theme_font_size_override("font_size", 14)
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
	decline_btn.add_theme_font_size_override("font_size", 14)
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


func _on_hand_card_drag_started(instance_id: String) -> void:
	var g: Dictionary = Connection.get_state().game_state
	var phase: String = g.get("phase", "")
	var turn_side: String = g.get("turnSide", "")
	var my_side: String = Connection.get_state().game_side
	var pub: Dictionary = g.get("publicState", {})
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
	if phase != "deploy" or turn_side != my_side:
		return
	var pub_drag: Dictionary = g.get("publicState", {})
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
			status_label.text = "Starships are played via Evacuate (transport) or interception (starfighter)."
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
	elif reason == "concede":
		reason_text = "Opponent Conceded"
	var won: bool = (winner == my_side)
	_game_over_received = true
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
	_game_over_layer = CanvasLayer.new()
	_game_over_layer.layer = 250
	add_child(_game_over_layer)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.0, 0.0, 0.05, 0.75)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_game_over_layer.add_child(bg)
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_CENTER)
	vbox.offset_left = -300
	vbox.offset_top = -120
	vbox.offset_right = 300
	vbox.offset_bottom = 120
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 16)
	_game_over_layer.add_child(vbox)
	var main_label := Label.new()
	main_label.text = "YOU WON!" if won else "YOU LOST"
	main_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	main_label.add_theme_font_size_override("font_size", 56)
	if won:
		main_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.2, 1))
	else:
		main_label.add_theme_color_override("font_color", Color(0.9, 0.25, 0.2, 1))
	main_label.modulate = Color(1, 1, 1, 0)
	main_label.scale = Vector2(0.5, 0.5)
	main_label.pivot_offset = Vector2(300, 30)
	vbox.add_child(main_label)
	var tween := create_tween()
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_BACK)
	tween.tween_property(main_label, "modulate:a", 1.0, 0.5)
	tween.parallel().tween_property(main_label, "scale", Vector2(1.0, 1.0), 0.6)
	if reason_text:
		var reason_label := Label.new()
		reason_label.text = reason_text
		reason_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		reason_label.add_theme_font_size_override("font_size", 22)
		reason_label.add_theme_color_override("font_color", Color(0.85, 0.85, 0.95, 1))
		vbox.add_child(reason_label)
	var lobby_btn := Button.new()
	lobby_btn.text = "Return to Lobby"
	lobby_btn.custom_minimum_size = Vector2(200, 40)
	lobby_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	lobby_btn.pressed.connect(_on_return_to_lobby_pressed)
	vbox.add_child(lobby_btn)


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


func _append_chat_line(from: String, text: String) -> void:
	var line: Label = Label.new()
	line.text = "%s: %s" % [from, text]
	line.add_theme_font_size_override("font_size", 13)
	line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	line.custom_minimum_size.x = 240
	chat_messages.add_child(line)
	var scroll: ScrollContainer = chat_messages.get_parent() as ScrollContainer
	if scroll:
		call_deferred("_scroll_chat_to_bottom", scroll)


func _on_chat_send() -> void:
	_send_chat_text(chat_input.text)
	chat_input.clear()


func _on_chat_submitted(new_text: String) -> void:
	_send_chat_text(new_text)
	chat_input.clear()


func _scroll_chat_to_bottom(scroll: ScrollContainer) -> void:
	if is_instance_valid(scroll):
		scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value)


func _send_chat_text(text: String) -> void:
	var t: String = text.strip_edges()
	if t.is_empty():
		return
	Connection.get_client().game_chat(t)


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
	if opp_deck:
		opp_deck.texture = opp_back
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
		your_discard_label.text = "Discard (%s)" % my_discard_count
	if opp_discard_label:
		opp_discard_label.text = "Discard (%s)" % opp_discard_count
	var light_planets_won: int = int(pub.get("lightPlanetsWon", 0))
	var dark_planets_won: int = int(pub.get("darkPlanetsWon", 0))
	var planet_score: String = ""
	if light_planets_won > 0 or dark_planets_won > 0:
		planet_score = "  |  Planets: L%d - D%d" % [light_planets_won, dark_planets_won]
	if phase == "determine_first":
		phase_label.text = "Determining first player..."
	elif phase == "choose_starting_location":
		if turn_side == my_side:
			phase_label.text = "Winner goes first — Choose your starting location"
		else:
			# Message shown once in location_choice_label (larger); avoid duplicate here
			phase_label.text = "Choose starting location"
	elif phase == "choose_next_planet":
		if turn_side == my_side:
			phase_label.text = "Planet controlled! Choose the next planet location" + planet_score
		else:
			phase_label.text = "Opponent choosing next planet..." + planet_score
	else:
		var display_phase: String = _phase_display_name(phase)
		phase_label.text = "Phase: %s  |  Turn: %s%s" % [display_phase, turn_side.capitalize(), planet_score]
	# Deck counts for hover display (deck count text at top removed)
	_your_deck_count = int((light if my_side == "light" else dark).get("deckCount", 0))
	_opp_deck_count = int((dark if my_side == "light" else light).get("deckCount", 0))
	# Force from server (counters per deploy turn)
	var my_force: int = int((light if my_side == "light" else dark).get("force", 0))
	var opp_force: int = int((dark if my_side == "light" else light).get("force", 0))
	# Force indicators: just ||| (no "Your force" text)
	if your_force_label:
		if phase == "deploy":
			your_force_label.visible = true
			your_force_label.text = "|".repeat(my_force) if my_force > 0 else "—"
		else:
			your_force_label.visible = false
	if opp_force_label:
		if phase == "deploy":
			opp_force_label.visible = true
			opp_force_label.text = "|".repeat(opp_force) if opp_force > 0 else "—"
		else:
			opp_force_label.visible = false
	# Opponent hand: show N card backs at top center
	if opponent_hand_container:
		for c in opponent_hand_container.get_children():
			c.queue_free()
		var opp_hand_count: int = int(dark.get("handCount", 0)) if my_side == "light" else int(light.get("handCount", 0))
		for i in range(opp_hand_count):
			var tr: TextureRect = TextureRect.new()
			tr.custom_minimum_size = Vector2(44, 62)
			tr.texture = opp_back
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
	pass_phase_btn.visible = is_my_turn and not evac_in_progress and (phase == "deploy" or (phase == "battle" and not battle_active))
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
	var in_declare_phase: bool = (phase == "battle" and declare_side != "")
	battle_btn.visible = is_my_turn and phase == "battle" and not any_face_down and not pub.get("battlePlanPhase", false) and not in_declare_phase
	if battle_plan_section:
		var in_battle_plan: bool = (phase == "battle" and pub.get("battlePlanPhase", false))
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
				battle_plan_label.text = "Battle Plan — drag cards left/right in the table above to set order (left = first to battle)"
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
					status_label.text = "Drag to reorder. %d Battle card%s added. Click Ready." % [bc_count, "s" if bc_count > 1 else ""]
				else:
					status_label.text = "Drag cards to set battle order, then click Battle Plan Ready."
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
		if battle_plan_section:
			battle_plan_section.visible = false
	else:
		discard_hand_btn.visible = is_my_turn and phase == "even_up"
		even_up_btn.visible = is_my_turn and phase == "even_up"
		discard_location_btn.visible = is_my_turn and phase == "even_up"
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
		if ep2 is Dictionary and str(ep2.get("side", "")) == my_side:
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
			label_parts.append("Light: %d  Dark: %d" % [int(l.get("destiny", 0)), int(d.get("destiny", 0))])
		destiny_compare_label.text = "  |  ".join(label_parts) + "  —  Higher goes first"
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
		else:
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
			return
	if phase != "draw":
		_initial_draw_animation_done = false
	# Hand label hidden (per request); only show choose-location hint when in that phase
	if hand_label:
		hand_label.visible = false
	if phase == "choose_starting_location":
		location_choice_section.visible = true
		if location_choice_label:
			if turn_side == my_side:
				location_choice_label.text = "Choose your starting location"
			else:
				location_choice_label.text = "Opponent choosing starting location"
	elif phase == "choose_next_planet":
		location_choice_section.visible = true
		if location_choice_label:
			if turn_side == my_side:
				location_choice_label.text = "Choose the next planet location"
			else:
				location_choice_label.text = "Opponent choosing next planet location"
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
	if phase == "battle" and pub.get("battlePlanPhase", false) and battle_plan_ready_btn and battle_plan_ready_btn.visible:
		battle_plan_ready_btn.disabled = _battle_plan_order.is_empty()
	play_card_btn.text = "Play Card"
	_update_controlled_planets_display(pub)
	_update_evacuation_ui(state, pub, phase, my_side)
	_previous_phase = phase


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
	if phase == "choose_starting_location":
		if turn_side == my_side:
			var starting_choices: Array = pub.get("startingLocationChoices", [])
			for choice in starting_choices:
				var inst_id: String = choice.get("instanceId", "")
				var card_id: String = choice.get("cardId", "")
				if not card_id:
					continue
				var card: Control = CardPlaceholderScene.instantiate()
				hand_container.add_child(card)
				card.set_card(card_id, inst_id, my_side, choice.get("set", ""))
				card.card_selected.connect(_on_starting_location_chosen)
		return
	if phase == "choose_next_planet":
		if turn_side == my_side:
			var next_choices: Array = pub.get("nextPlanetChoices", [])
			for choice in next_choices:
				var inst_id: String = choice.get("instanceId", "")
				var card_id: String = choice.get("cardId", "")
				if not card_id:
					continue
				var card: Control = CardPlaceholderScene.instantiate()
				hand_container.add_child(card)
				card.set_card(card_id, inst_id, my_side, choice.get("set", ""))
				card.card_selected.connect(_on_next_planet_chosen)
		return
	for entry in state.hand_with_instances:
		var inst_id: String = entry.get("instanceId", "")
		var card_id: String = entry.get("cardId", "")
		if _battle_cards_in_plan.has(inst_id) or _declared_battle_cards.has(inst_id):
			continue
		var card: Control = CardPlaceholderScene.instantiate()
		hand_container.add_child(card)
		card.set_card(card_id, inst_id, my_side, entry.get("set", ""))
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


func _on_effect_decline_pressed() -> void:
	Connection.get_client().send_message({
		"type": "game_action",
		"action": { "kind": "effect_decline" }
	})


func _on_my_in_play_effect_clicked(instance_id: String) -> void:
	var g: Dictionary = Connection.get_state().game_state
	var phase: String = g.get("phase", "")
	var turn_side: String = g.get("turnSide", "")
	var my_side: String = Connection.get_state().game_side
	var pub: Dictionary = g.get("publicState", {})
	if phase != "deploy" or turn_side != my_side:
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
		for entry in Connection.get_state().hand_with_instances:
			if entry.get("instanceId", "") == instance_id:
				card_id = entry.get("cardId", "")
				break
		if card_id and CardCatalog and CardCatalog.get_card_info(card_id, my_side).get("type", "") == "location":
			_discard_location_mode = false
			Connection.get_client().send_message({
				"type": "game_action",
				"action": { "kind": "discard_location", "instanceId": instance_id }
			})
			_refresh()
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
			cp.card_selected.connect(_on_location_card_clicked)
			return
	for card in dark_in_play:
		if card.get("instanceId", "") == instance_id:
			var card_id: String = card.get("cardId", "?")
			_set_starting_location_planet_label(card_id)
			var cp: Control = CardPlaceholderScene.instantiate()
			starting_location_slot.add_child(cp)
			cp.set_card(card_id, instance_id, "dark")
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
	if is_my_turn:
		var prompt_label: Label = Label.new()
		prompt_label.text = "Drag Battle cards from your hand onto the table, then click Confirm."
		prompt_label.add_theme_font_size_override("font_size", 14)
		prompt_label.add_theme_color_override("font_color", Color(0.85, 0.75, 0.4, 1))
		container.add_child(prompt_label)
		var btn_row: HBoxContainer = HBoxContainer.new()
		btn_row.add_theme_constant_override("separation", 12)
		container.add_child(btn_row)
		var confirm_btn: Button = Button.new()
		confirm_btn.text = "Confirm Battle Cards (%d)" % _declared_battle_cards.size()
		confirm_btn.pressed.connect(_on_declare_battle_cards_confirmed)
		btn_row.add_child(confirm_btn)
		if not _declared_battle_cards.is_empty():
			var undo_btn: Button = Button.new()
			undo_btn.text = "Remove All"
			undo_btn.pressed.connect(_on_declare_battle_cards_clear)
			btn_row.add_child(undo_btn)
		status_label.text = "Declare your Battle cards. Drag from hand onto the table."
	else:
		var wait_label: Label = Label.new()
		wait_label.text = "Waiting for opponent to declare Battle cards..."
		wait_label.add_theme_font_size_override("font_size", 14)
		wait_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7, 1))
		container.add_child(wait_label)
		status_label.text = "Waiting for opponent to declare Battle cards..."


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
	ps.bg_color = Color(0.07, 0.08, 0.14, 0.88)
	ps.border_width_left = 1
	ps.border_width_top = 1
	ps.border_width_right = 1
	ps.border_width_bottom = 1
	ps.border_color = Color(0.3, 0.4, 0.6, 0.4)
	ps.corner_radius_top_left = 10
	ps.corner_radius_top_right = 10
	ps.corner_radius_bottom_left = 10
	ps.corner_radius_bottom_right = 10
	ps.set_content_margin_all(10)
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
	title_lbl.add_theme_font_size_override("font_size", 20)
	title_lbl.add_theme_color_override("font_color", Color(0.95, 0.85, 0.4, 1))
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
	vs_style.bg_color = Color(0.15, 0.16, 0.25, 0.95)
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
	wps.bg_color = Color(0.12, 0.14, 0.22, 0.9)
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
	cs.bg_color = Color(0.11, 0.12, 0.2, 0.85)
	cs.border_width_left = 2
	cs.border_width_top = 2
	cs.border_width_right = 2
	cs.border_width_bottom = 2
	cs.border_color = Color(0.3, 0.6, 0.9, 0.5) if side == "light" else Color(0.8, 0.25, 0.2, 0.5)
	cs.corner_radius_top_left = 8
	cs.corner_radius_top_right = 8
	cs.corner_radius_bottom_left = 8
	cs.corner_radius_bottom_right = 8
	cs.set_content_margin_all(6)
	column.add_theme_stylebox_override("panel", cs)
	parent.add_child(column)
	var vb: VBoxContainer = VBoxContainer.new()
	vb.add_theme_constant_override("separation", 3)
	vb.alignment = BoxContainer.ALIGNMENT_BEGIN
	column.add_child(vb)
	var sl: Label = Label.new()
	sl.name = "SideLabel"
	sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sl.add_theme_font_size_override("font_size", 13)
	sl.add_theme_color_override("font_color", Color(0.4, 0.75, 1.0, 1) if side == "light" else Color(1.0, 0.35, 0.3, 1))
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
	bl.add_theme_font_size_override("normal_font_size", 12)
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
	var cw: float = 110.0
	var ch: float = 156.0
	var ww: float = 72.0
	var wh: float = 102.0
	if has_3:
		cw = 68.0
		ch = 96.0
		ww = 46.0
		wh = 65.0
	elif multi:
		cw = 84.0
		ch = 120.0
		ww = 56.0
		wh = 80.0
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
			bc_slot.add_child(_create_battle_card(bc_id, side, 56.0, 80.0, 40.0))
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
	var in_declare_or_plan: bool = pub.get("battleCardDeclareSide", "") != "" or pub.get("battlePlanPhase", false)
	var in_battle_plan: bool = pub.get("battlePlanPhase", false)
	var in_battle_card_declare: bool = (pub.get("battleCardDeclareSide", "") != "") and not in_battle_plan
	var opp_bc_count: int = int(pub.get("darkBattleCardCount", 0)) if my_side == "light" else int(pub.get("lightBattleCardCount", 0))
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
				_animate_in_play_card(cp, my_turn_count, face_down)
				if not face_down and CardCatalog and not in_battle_card_declare:
					var ct: String = str(CardCatalog.get_card_info(card.get("cardId", ""), my_side, card.get("set", "")).get("type", "")).to_lower()
					if ct == "effect" and cp.has_signal("card_selected"):
						cp.card_selected.connect(_on_my_in_play_effect_clicked)
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
	if opp_play_container:
		var opp_face_down: bool = in_battle_plan
		for card in opp_in_play:
			if card.get("instanceId", "") == starting_inst_id:
				continue
			if CardCatalog:
				var oty: String = str(CardCatalog.get_card_info(card.get("cardId", ""), opp_side, card.get("set", "")).get("type", "")).to_lower()
				if oty == "location":
					continue
				if in_battle_card_declare and oty == "effect":
					continue
			var cp: Control = CardPlaceholderScene.instantiate()
			opp_play_container.add_child(cp)
			var face_down: bool = opp_face_down or card.get("faceDown", false)
			cp.set_card(card.get("cardId", "?"), card.get("instanceId", ""), opp_side, card.get("set", ""), face_down, false)
			_animate_in_play_card(cp, opp_turn_count, face_down)
		if in_declare_or_plan and opp_bc_count > 0:
			for i in range(opp_bc_count):
				var cp: Control = CardPlaceholderScene.instantiate()
				opp_play_container.add_child(cp)
				cp.set_card("", "", opp_side, "", true, false)
		# Show "(X battle cards)" by opponent's face-down cards during battle plan; hide when cards turn face up
		if opponent_battle_cards_label:
			opponent_battle_cards_label.visible = in_battle_plan and opp_bc_count > 0
			if opponent_battle_cards_label.visible:
				opponent_battle_cards_label.text = "(%d battle card%s)" % [opp_bc_count, "s" if opp_bc_count != 1 else ""]


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
	# Must match server getCharactersAtLocation: only character + weapon (effects/starships/etc. stay at location but do not go in the pile).
	if not CardCatalog:
		return false
	var t: String = str(CardCatalog.get_card_info(card.get("cardId", ""), my_side).get("type", "")).to_lower()
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


func _on_discard_location_pressed() -> void:
	var state: RefCounted = Connection.get_state()
	var has_location_in_hand: bool = false
	for entry in state.hand_with_instances:
		var card_id: String = entry.get("cardId", "")
		if CardCatalog and CardCatalog.get_card_info(card_id, state.game_side).get("type", "") == "location":
			has_location_in_hand = true
			break
	if not has_location_in_hand:
		status_label.text = "You have no location cards in hand to discard."
		return
	_discard_location_mode = true
	status_label.text = "Click a location card in your hand to discard it."
	_refresh()


func _on_concede_pressed() -> void:
	Connection.get_client().game_concede()


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


func _animate_destiny_cards_from_decks(opp_card_id: String, your_card_id: String, opp_side: String) -> void:
	var my_side: String = Connection.get_state().game_side
	var flying_opp: Control = null
	var flying_yours: Control = null
	if opp_card_id:
		flying_opp = CardPlaceholderScene.instantiate()
		add_child(flying_opp)
		flying_opp.set_card(opp_card_id, "", opp_side)
		flying_opp.set_anchors_preset(Control.PRESET_TOP_LEFT)
		flying_opp.global_position = opp_deck.get_global_rect().position + (opp_deck.get_global_rect().size - flying_opp.custom_minimum_size) / 2
		flying_opp.z_index = 100
	if your_card_id:
		flying_yours = CardPlaceholderScene.instantiate()
		add_child(flying_yours)
		flying_yours.set_card(your_card_id, "", my_side)
		flying_yours.set_anchors_preset(Control.PRESET_TOP_LEFT)
		flying_yours.global_position = your_deck.get_global_rect().position + (your_deck.get_global_rect().size - flying_yours.custom_minimum_size) / 2
		flying_yours.z_index = 100
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_BACK)
	if flying_opp:
		var slot_rect: Rect2 = opponent_destiny_slot.get_global_rect()
		var end_pos: Vector2 = slot_rect.position + (slot_rect.size - flying_opp.custom_minimum_size) / 2
		tween.tween_property(flying_opp, "global_position", end_pos, 0.5)
	if flying_yours:
		var slot_rect: Rect2 = your_destiny_slot.get_global_rect()
		var end_pos: Vector2 = slot_rect.position + (slot_rect.size - flying_yours.custom_minimum_size) / 2
		tween.tween_property(flying_yours, "global_position", end_pos, 0.5)
	tween.tween_callback(func() -> void:
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
	var flying_cards: Array = []
	for i in range(hand_entries.size()):
		var entry: Dictionary = hand_entries[i]
		var card_id: String = entry.get("cardId", "")
		var inst_id: String = entry.get("instanceId", "")
		if card_id.is_empty():
			continue
		var flying: Control = CardPlaceholderScene.instantiate()
		add_child(flying)
		flying.set_card(card_id, inst_id, my_side)
		flying.set_anchors_preset(Control.PRESET_TOP_LEFT)
		var card_size: Vector2 = flying.custom_minimum_size
		flying.global_position = deck_rect.position + (deck_rect.size - card_size) / 2
		flying.z_index = 100
		flying_cards.append(flying)
	# Stagger: tween each card to a target in the hand area
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_BACK)
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
	add_child(flying)
	flying.set_card(card_id, "", my_side)
	flying.set_anchors_preset(Control.PRESET_TOP_LEFT)
	var card_size: Vector2 = flying.custom_minimum_size
	var deck_rect: Rect2 = from_deck.get_global_rect()
	var slot_rect: Rect2 = to_slot.get_global_rect()
	flying.global_position = deck_rect.position + (deck_rect.size - card_size) / 2
	flying.z_index = 100
	var end_pos: Vector2 = slot_rect.position + (slot_rect.size - card_size) / 2
	var tween: Tween = create_tween()
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_BACK)
	tween.tween_property(flying, "global_position", end_pos, 0.55)
	tween.tween_callback(flying.queue_free)
