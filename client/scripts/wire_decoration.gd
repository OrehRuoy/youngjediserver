## Draws decorative circuit/wire lines around child PanelContainers.
## Attach to a Control that is a sibling or ancestor of the panels.
## Set panel_paths from the scene, or it auto-detects PanelContainer children.

@tool
extends Control

@export var wire_color_left: Color = Color(0.25, 0.5, 0.85, 0.35)
@export var wire_color_right: Color = Color(0.75, 0.25, 0.25, 0.35)
@export var wire_thickness: float = 1.5
@export var node_radius: float = 3.0
@export var wire_extend: float = 28.0
@export var branch_length: float = 16.0
@export var corner_inset: float = 20.0

var _left_rect: Rect2 = Rect2()
var _right_rect: Rect2 = Rect2()
var _left_color: Color = Color()
var _right_color: Color = Color()


func setup(left_rect: Rect2, right_rect: Rect2, left_color: Color = Color(), right_color: Color = Color()) -> void:
	_left_rect = left_rect
	_right_rect = right_rect
	_left_color = left_color if left_color.a > 0 else wire_color_left
	_right_color = right_color if right_color.a > 0 else wire_color_right
	queue_redraw()


func _draw() -> void:
	if _left_rect.size.x < 1 or _right_rect.size.x < 1:
		return
	_draw_panel_wires(_left_rect, _left_color)
	_draw_panel_wires(_right_rect, _right_color)
	_draw_connection_wires()


func _draw_panel_wires(r: Rect2, col: Color) -> void:
	var tl := r.position
	var tr := Vector2(r.end.x, r.position.y)
	var bl := Vector2(r.position.x, r.end.y)
	var br := r.end
	var ci := corner_inset
	var ext := wire_extend
	var bl_ := branch_length

	# Top-left corner bracket
	_draw_wire(Vector2(tl.x - ext, tl.y), Vector2(tl.x + ci, tl.y), col)
	_draw_wire(Vector2(tl.x, tl.y - ext), Vector2(tl.x, tl.y + ci), col)
	_draw_node(tl, col)
	# Branch from top-left
	_draw_wire(Vector2(tl.x - ext, tl.y), Vector2(tl.x - ext, tl.y - bl_), col)
	_draw_node(Vector2(tl.x - ext, tl.y), col)

	# Top-right corner bracket
	_draw_wire(Vector2(tr.x - ci, tr.y), Vector2(tr.x + ext, tr.y), col)
	_draw_wire(Vector2(tr.x, tr.y - ext), Vector2(tr.x, tr.y + ci), col)
	_draw_node(tr, col)
	_draw_wire(Vector2(tr.x + ext, tr.y), Vector2(tr.x + ext, tr.y - bl_), col)
	_draw_node(Vector2(tr.x + ext, tr.y), col)

	# Bottom-left corner bracket
	_draw_wire(Vector2(bl.x - ext, bl.y), Vector2(bl.x + ci, bl.y), col)
	_draw_wire(Vector2(bl.x, bl.y - ci), Vector2(bl.x, bl.y + ext), col)
	_draw_node(bl, col)
	_draw_wire(Vector2(bl.x - ext, bl.y), Vector2(bl.x - ext, bl.y + bl_), col)
	_draw_node(Vector2(bl.x - ext, bl.y), col)

	# Bottom-right corner bracket
	_draw_wire(Vector2(br.x - ci, br.y), Vector2(br.x + ext, br.y), col)
	_draw_wire(Vector2(br.x, br.y - ci), Vector2(br.x, br.y + ext), col)
	_draw_node(br, col)
	_draw_wire(Vector2(br.x + ext, br.y), Vector2(br.x + ext, br.y + bl_), col)
	_draw_node(Vector2(br.x + ext, br.y), col)

	# Mid-edge accents (short horizontal ticks on left/right edges)
	var mid_y := r.position.y + r.size.y * 0.5
	_draw_wire(Vector2(r.position.x - ext * 0.6, mid_y), Vector2(r.position.x, mid_y), col)
	_draw_node(Vector2(r.position.x - ext * 0.6, mid_y), col)
	_draw_wire(Vector2(r.end.x, mid_y), Vector2(r.end.x + ext * 0.6, mid_y), col)
	_draw_node(Vector2(r.end.x + ext * 0.6, mid_y), col)

	# Mid top/bottom ticks
	var mid_x := r.position.x + r.size.x * 0.5
	_draw_wire(Vector2(mid_x, r.position.y - ext * 0.5), Vector2(mid_x, r.position.y), col)
	_draw_node(Vector2(mid_x, r.position.y - ext * 0.5), col)
	_draw_wire(Vector2(mid_x, r.end.y), Vector2(mid_x, r.end.y + ext * 0.5), col)
	_draw_node(Vector2(mid_x, r.end.y + ext * 0.5), col)


func _draw_connection_wires() -> void:
	if _left_rect.size.x < 1 or _right_rect.size.x < 1:
		return
	var gap_x1 := _left_rect.end.x
	var gap_x2 := _right_rect.position.x
	if gap_x2 <= gap_x1:
		return
	var mid_x := (gap_x1 + gap_x2) * 0.5
	var blend := Color(
		(_left_color.r + _right_color.r) * 0.5,
		(_left_color.g + _right_color.g) * 0.5,
		(_left_color.b + _right_color.b) * 0.5,
		(_left_color.a + _right_color.a) * 0.5
	)

	# Top connection: horizontal wire across gap with vertical ticks
	var top_y := minf(_left_rect.position.y, _right_rect.position.y) + corner_inset * 2
	_draw_wire(Vector2(gap_x1, top_y), Vector2(gap_x2, top_y), blend)
	_draw_node(Vector2(mid_x, top_y), blend)
	_draw_wire(Vector2(mid_x, top_y - branch_length), Vector2(mid_x, top_y + branch_length), blend)
	_draw_node(Vector2(mid_x, top_y - branch_length), blend)
	_draw_node(Vector2(mid_x, top_y + branch_length), blend)

	# Bottom connection
	var bot_y := maxf(_left_rect.end.y, _right_rect.end.y) - corner_inset * 2
	_draw_wire(Vector2(gap_x1, bot_y), Vector2(gap_x2, bot_y), blend)
	_draw_node(Vector2(mid_x, bot_y), blend)
	_draw_wire(Vector2(mid_x, bot_y - branch_length), Vector2(mid_x, bot_y + branch_length), blend)
	_draw_node(Vector2(mid_x, bot_y - branch_length), blend)
	_draw_node(Vector2(mid_x, bot_y + branch_length), blend)

	# Middle vertical connector
	_draw_wire(Vector2(mid_x, top_y + branch_length), Vector2(mid_x, bot_y - branch_length), blend)


func _draw_wire(from: Vector2, to: Vector2, col: Color) -> void:
	draw_line(from, to, col, wire_thickness, true)


func _draw_node(pos: Vector2, col: Color) -> void:
	var bright := Color(col.r * 1.6, col.g * 1.6, col.b * 1.6, minf(col.a * 2.0, 1.0))
	draw_circle(pos, node_radius, bright)
