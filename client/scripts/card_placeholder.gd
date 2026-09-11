## Single card placeholder: shows card image (from set/light or set/dark, e.g. thejedicouncil or menaceofdarthmaul) or name fallback.
## Location cards use a wider size for horizontal art. Hover shows a larger readable popup.
## When instance_id is set, clicking emits card_selected(instance_id).
extends Button

signal card_selected(instance_id: String)
signal drag_started(instance_id: String)
signal drag_ended(instance_id: String)

const CARD_SIZE_NORMAL := Vector2(96, 136)
const CARD_SIZE_LOCATION := Vector2(136, 96)
const POPUP_SIZE_NORMAL := Vector2(264, 376)
const POPUP_SIZE_LOCATION := Vector2(372, 264)

@onready var card_image: TextureRect = $Panel/Margin/CardImage
@onready var card_label: Label = $Panel/Margin/Label

var _instance_id: String = ""
var _card_id: String = ""
var _card_name: String = ""
var _card_set: String = ""
var _current_texture: Texture2D = null
var _is_location: bool = false
var _hover_popup: Control = null
var _hover_timer: Timer = null
var _face_down: bool = false
var _show_name_on_hover: bool = true
var _side_for_back: String = ""
var _might_drag: bool = false
var _dragging: bool = false
var _drag_start_pos: Vector2 = Vector2.ZERO
const DRAG_THRESHOLD: float = 8.0


func _ready() -> void:
	pressed.connect(_on_pressed)
	mouse_entered.connect(_on_mouse_entered)
	mouse_exited.connect(_on_mouse_exited)


func _exit_tree() -> void:
	_hide_hover_popup()
	if _hover_timer:
		_hover_timer.stop()
		_hover_timer.queue_free()
		_hover_timer = null


func set_card(card_id: String, instance_id: String = "", side_hint: String = "", set_hint: String = "", face_down: bool = false, is_mine: bool = true) -> void:
	_card_id = card_id
	_instance_id = instance_id
	disabled = instance_id.is_empty()
	_face_down = face_down
	_show_name_on_hover = is_mine
	_side_for_back = side_hint

	# Resolve refs if set_card was called before _ready (e.g. before add_child)
	var img: TextureRect = card_image
	var lbl: Label = card_label
	if not img:
		img = get_node_or_null("Panel/Margin/CardImage") as TextureRect
	if not lbl:
		lbl = get_node_or_null("Panel/Margin/Label") as Label

	var info: Dictionary = {}
	if CardCatalog:
		info = CardCatalog.get_card_info(card_id, side_hint, set_hint)

	_card_name = info.get("name", card_id.replace("_", " "))
	_card_set = info.get("set", "")
	_is_location = info.get("type", "") == "location"

	var name_str: String = _card_name
	if name_str.length() > 14:
		name_str = name_str.substr(0, 14) + "…"
	# No text tooltip; only the larger image popup on hover
	tooltip_text = ""

	# Location cards: wider slot for horizontal art
	if _is_location:
		custom_minimum_size = CARD_SIZE_LOCATION
	else:
		custom_minimum_size = CARD_SIZE_NORMAL

	# Face down: show card back (light/dark) only; keep card info for hover when is_mine
	if face_down and img:
		var back_path: String = "res://assets/card_back_light.png" if (side_hint == "light" or info.get("side", "") == "light") else "res://assets/card_back_dark.png"
		var back_tex := load(back_path) as Texture2D
		if back_tex:
			_current_texture = null
			img.texture = back_tex
			img.visible = true
			if lbl:
				lbl.visible = false
			return

	var side: String = info.get("side", "")
	if side and img and CardCatalog:
		var paths_to_try: Array[String] = CardCatalog.get_card_image_paths(card_id, side_hint)
		for path in paths_to_try:
			var tex = load(path) as Texture2D
			if tex:
				_current_texture = tex
				img.texture = tex
				img.visible = true
				if lbl:
					lbl.visible = false
				return
	# Fallback: no image or not found
	_current_texture = null
	if img:
		img.texture = null
		img.visible = false
	if lbl:
		lbl.text = name_str
		lbl.visible = true


func _gui_input(event: InputEvent) -> void:
	if _instance_id.is_empty():
		return
	if event is InputEventMouseButton:
		var e: InputEventMouseButton = event
		if e.button_index == MOUSE_BUTTON_LEFT:
			if e.pressed:
				_might_drag = true
				_drag_start_pos = get_global_mouse_position()
			else:
				if _dragging:
					drag_ended.emit(_instance_id)
					get_viewport().set_input_as_handled()
				_dragging = false
				_might_drag = false
	if event is InputEventMouseMotion:
		if _might_drag and (event.button_mask & MOUSE_BUTTON_LEFT) and _drag_start_pos.distance_to(get_global_mouse_position()) > DRAG_THRESHOLD:
			if not _dragging:
				_dragging = true
				drag_started.emit(_instance_id)


func _on_pressed() -> void:
	_hide_hover_popup()
	if _dragging:
		return
	if not _instance_id.is_empty():
		card_selected.emit(_instance_id)


func _on_mouse_entered() -> void:
	if _hover_timer:
		_hover_timer = null
	_show_hover_popup()


func _on_mouse_exited() -> void:
	# Delay hide so user can move mouse to the popup to read it
	if _hover_timer:
		_hover_timer.stop()
		_hover_timer.queue_free()
	_hover_timer = Timer.new()
	_hover_timer.one_shot = true
	_hover_timer.wait_time = 0.25
	_hover_timer.timeout.connect(_hide_hover_popup_delayed)
	add_child(_hover_timer)
	_hover_timer.start()


func _hide_hover_popup_delayed() -> void:
	if _hover_timer:
		_hover_timer.queue_free()
		_hover_timer = null
	_hide_hover_popup()


func _show_hover_popup() -> void:
	_hide_hover_popup()
	# Face-down opponent card: do not show any popup
	if _face_down and not _show_name_on_hover:
		return
	# Face-down my card: show name and card image so player can remember
	if _face_down and _show_name_on_hover:
		_show_face_down_hover_popup()
		return
	if not _current_texture:
		return
	var root: Window = get_tree().root
	var popup: PanelContainer = PanelContainer.new()
	popup.mouse_filter = Control.MOUSE_FILTER_STOP
	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	popup.add_child(margin)
	var tex_rect: TextureRect = TextureRect.new()
	tex_rect.texture = _current_texture
	tex_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	if _is_location:
		tex_rect.custom_minimum_size = POPUP_SIZE_LOCATION
	else:
		tex_rect.custom_minimum_size = POPUP_SIZE_NORMAL
	margin.add_child(tex_rect)
	# Style popup
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.1, 0.18, 0.98)
	style.border_color = Color(0.4, 0.6, 0.9, 1)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	popup.add_theme_stylebox_override("panel", style)
	# Position above the card (like hand cards); if that would go off top, clamp to top of screen
	var card_rect: Rect2 = get_global_rect()
	var popup_size: Vector2 = Vector2(tex_rect.custom_minimum_size.x + 24, tex_rect.custom_minimum_size.y + 24)
	var above_y: float = card_rect.position.y - popup_size.y - 8
	popup.position = Vector2(card_rect.position.x, above_y)
	if popup.position.y < 0:
		popup.position.y = 8
	popup.size = popup_size
	root.add_child(popup)
	_hover_popup = popup
	popup.mouse_entered.connect(_on_popup_mouse_entered)
	popup.mouse_exited.connect(_on_popup_mouse_exited)


func _show_face_down_hover_popup() -> void:
	var root: Window = get_tree().root
	var popup: PanelContainer = PanelContainer.new()
	popup.mouse_filter = Control.MOUSE_FILTER_STOP
	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	popup.add_child(margin)
	var vbox: VBoxContainer = VBoxContainer.new()
	var name_label: Label = Label.new()
	name_label.text = _card_name
	name_label.add_theme_font_size_override("font_size", 16)
	name_label.add_theme_color_override("font_color", Color(1, 1, 1, 1))
	vbox.add_child(name_label)
	var info: Dictionary = CardCatalog.get_card_info(_card_id, _side_for_back) if CardCatalog else {}
	var side: String = info.get("side", _side_for_back)
	if side and CardCatalog:
		var paths_to_try: Array[String] = CardCatalog.get_card_image_paths(_card_id, _side_for_back)
		for path in paths_to_try:
			var tex = load(path) as Texture2D
			if tex:
				var tex_rect: TextureRect = TextureRect.new()
				tex_rect.texture = tex
				tex_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
				tex_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
				tex_rect.custom_minimum_size = POPUP_SIZE_LOCATION if _is_location else POPUP_SIZE_NORMAL
				vbox.add_child(tex_rect)
				break
	margin.add_child(vbox)
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.1, 0.18, 0.98)
	style.border_color = Color(0.4, 0.6, 0.9, 1)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	popup.add_theme_stylebox_override("panel", style)
	var card_rect: Rect2 = get_global_rect()
	var popup_size: Vector2
	if vbox.get_child_count() > 1:
		popup_size = Vector2((POPUP_SIZE_NORMAL.x if not _is_location else POPUP_SIZE_LOCATION.x) + 24, (POPUP_SIZE_NORMAL.y if not _is_location else POPUP_SIZE_LOCATION.y) + 24 + 24)
	else:
		popup_size = Vector2(220, 24 + name_label.get_minimum_size().y + 12)
	var above_y: float = card_rect.position.y - popup_size.y - 8
	popup.position = Vector2(card_rect.position.x, above_y)
	if popup.position.y < 0:
		popup.position.y = 8
	popup.size = popup_size
	root.add_child(popup)
	_hover_popup = popup
	popup.mouse_entered.connect(_on_popup_mouse_entered)
	popup.mouse_exited.connect(_on_popup_mouse_exited)


func _on_popup_mouse_entered() -> void:
	if _hover_timer:
		_hover_timer.stop()
		_hover_timer.queue_free()
		_hover_timer = null


func _on_popup_mouse_exited() -> void:
	_hide_hover_popup_delayed()


func _hide_hover_popup() -> void:
	if _hover_popup and is_instance_valid(_hover_popup):
		_hover_popup.queue_free()
		_hover_popup = null


## Call from game scene to clear hover when e.g. Play is pressed or state refreshes.
func hide_hover_popup() -> void:
	_hide_hover_popup()
	if _hover_timer:
		_hover_timer.stop()
		_hover_timer.queue_free()
		_hover_timer = null
