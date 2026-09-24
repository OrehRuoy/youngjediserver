## Draggable card for battle plan row only. Control + texture so drag always works (no Button).
## Shows larger image on hover; hover is hidden when drag starts so it doesn't interfere.
extends Control

const CardArt = preload("res://scripts/card_art.gd")

signal drag_started(instance_id: String)
signal drag_ended(instance_id: String)

var _instance_id: String = ""
var _card_id: String = ""
var _side: String = ""
var _face_down: bool = false
var _texture_rect: TextureRect = null
var _might_drag: bool = false
var _dragging: bool = false
var _drag_start_pos: Vector2 = Vector2.ZERO
var _hover_popup: Control = null
var _hover_timer: Timer = null
var _current_texture: Texture2D = null
const DRAG_THRESHOLD: float = 8.0
const POPUP_SIZE := Vector2(264, 376)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_preset(Control.PRESET_TOP_LEFT)
	custom_minimum_size = Vector2(96, 136)
	_texture_rect = TextureRect.new()
	_texture_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_texture_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_texture_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_texture_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	add_child(_texture_rect)
	mouse_entered.connect(_on_battle_plan_card_mouse_entered)
	mouse_exited.connect(_on_battle_plan_card_mouse_exited)


func _exit_tree() -> void:
	_hide_hover_popup()
	if _hover_timer and is_instance_valid(_hover_timer):
		_hover_timer.stop()
		_hover_timer.queue_free()
		_hover_timer = null


func set_face_down(face_down: bool) -> void:
	_face_down = face_down
	if _texture_rect and face_down:
		var back_tex: Texture2D = load("res://assets/card_back_light.png") as Texture2D if _side == "light" else load("res://assets/card_back_dark.png") as Texture2D
		if back_tex and CardCatalog:
			back_tex = CardCatalog.smooth_texture(back_tex)
		if back_tex:
			_texture_rect.texture = back_tex
			_texture_rect.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR


func set_card(card_id: String, instance_id: String, side: String) -> void:
	_card_id = card_id
	_instance_id = instance_id
	_side = side
	var tex: Texture2D = CardArt.load_texture(card_id, side, "")
	if not tex:
		tex = load("res://assets/card_back_light.png") as Texture2D if side == "light" else load("res://assets/card_back_dark.png") as Texture2D
		if tex and CardCatalog:
			tex = CardCatalog.smooth_texture(tex)
	_current_texture = tex
	if _texture_rect:
		_texture_rect.texture = tex


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
				_hide_hover_popup()
				if _hover_timer and is_instance_valid(_hover_timer):
					_hover_timer.stop()
					_hover_timer.queue_free()
					_hover_timer = null
				drag_started.emit(_instance_id)
				get_viewport().set_input_as_handled()


func _on_battle_plan_card_mouse_entered() -> void:
	if _hover_timer and is_instance_valid(_hover_timer):
		_hover_timer.stop()
		_hover_timer.queue_free()
		_hover_timer = null
	if _dragging:
		return
	_hover_timer = Timer.new()
	_hover_timer.one_shot = true
	_hover_timer.wait_time = 0.2
	_hover_timer.timeout.connect(_show_hover_popup_delayed)
	add_child(_hover_timer)
	_hover_timer.start()


func _on_battle_plan_card_mouse_exited() -> void:
	if _hover_timer and is_instance_valid(_hover_timer):
		_hover_timer.stop()
		_hover_timer.queue_free()
		_hover_timer = null
	_hover_timer = Timer.new()
	_hover_timer.one_shot = true
	_hover_timer.wait_time = 0.25
	_hover_timer.timeout.connect(_hide_hover_popup_delayed)
	add_child(_hover_timer)
	_hover_timer.start()


func _show_hover_popup_delayed() -> void:
	_hover_timer = null
	if _dragging or _might_drag:
		return
	_show_hover_popup()


func _hide_hover_popup_delayed() -> void:
	if _hover_timer:
		_hover_timer.queue_free()
		_hover_timer = null
	_hide_hover_popup()


func _show_hover_popup() -> void:
	_hide_hover_popup()
	if not _current_texture:
		return
	var root: Window = get_tree().root
	var popup: PanelContainer = PanelContainer.new()
	popup.mouse_filter = Control.MOUSE_FILTER_IGNORE
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
	tex_rect.custom_minimum_size = POPUP_SIZE
	margin.add_child(tex_rect)
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.1, 0.18, 0.98)
	style.border_color = Color(0.4, 0.6, 0.9, 1)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	popup.add_theme_stylebox_override("panel", style)
	var card_rect: Rect2 = get_global_rect()
	var popup_size: Vector2 = Vector2(POPUP_SIZE.x + 24, POPUP_SIZE.y + 24)
	var above_y: float = card_rect.position.y - popup_size.y - 8
	popup.position = Vector2(card_rect.position.x, above_y)
	var vp: Rect2 = get_viewport().get_visible_rect()
	if popup.position.y < 0:
		popup.position.y = 8
	popup.position.x = clampf(popup.position.x, 0, vp.size.x - popup_size.x)
	popup.size = popup_size
	root.add_child(popup)
	_hover_popup = popup


func _hide_hover_popup() -> void:
	if _hover_popup and is_instance_valid(_hover_popup):
		_hover_popup.queue_free()
		_hover_popup = null


func get_card_instance_id() -> String:
	return _instance_id
