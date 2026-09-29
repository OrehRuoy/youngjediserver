## Shared look for the two waiting rooms (table + bot game): seat panels and pill-shaped chips.
## Load with: const SeatStyle = preload("res://scripts/seat_style.gd")
extends Object

const LIGHT := Color(0.3, 0.6, 1.0, 1)
const DARK := Color(0.95, 0.35, 0.35, 1)
const READY := Color(0.35, 0.9, 0.45, 1)
const IDLE := Color(0.6, 0.66, 0.78, 1)
const WARN := Color(0.95, 0.75, 0.3, 1)

# Panel colours match the values the scenes originally shipped with.
const _LIGHT_BG := Color(0.03, 0.06, 0.16, 0.92)
const _LIGHT_EDGE := Color(0.2, 0.45, 0.8, 0.9)
const _LIGHT_GLOW := Color(0.1, 0.25, 0.55, 0.3)
const _DARK_BG := Color(0.14, 0.04, 0.04, 0.92)
const _DARK_EDGE := Color(0.75, 0.2, 0.2, 0.9)
const _DARK_GLOW := Color(0.45, 0.1, 0.1, 0.3)
const _READY_EDGE := Color(0.3, 0.85, 0.4, 0.95)
const _READY_GLOW := Color(0.15, 0.6, 0.25, 0.4)


## Seat panel. A ready seat swaps its border and glow to green so the state reads at a glance.
static func seat_panel(is_light: bool, ready: bool = false) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	var bg: Color = _LIGHT_BG if is_light else _DARK_BG
	s.bg_color = bg.lerp(Color(0.05, 0.2, 0.1, bg.a), 0.35) if ready else bg
	s.border_color = _READY_EDGE if ready else (_LIGHT_EDGE if is_light else _DARK_EDGE)
	s.shadow_color = _READY_GLOW if ready else (_LIGHT_GLOW if is_light else _DARK_GLOW)
	s.set_border_width_all(2)
	s.set_corner_radius_all(10)
	s.set_content_margin_all(20)
	s.shadow_size = 16 if ready else 12
	s.shadow_offset = Vector2(0, 2)
	return s


## Soft coloured halo behind a card back or avatar.
static func glow_panel(is_light: bool) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	if is_light:
		s.bg_color = Color(0.15, 0.35, 0.75, 0.08)
		s.shadow_color = Color(0.2, 0.4, 0.9, 0.22)
	else:
		s.bg_color = Color(0.6, 0.15, 0.15, 0.08)
		s.shadow_color = Color(0.85, 0.2, 0.2, 0.22)
	s.set_corner_radius_all(8)
	s.set_content_margin_all(10)
	s.shadow_size = 6
	return s


## Turns a Label into a rounded pill in `color` (border + faint fill, lightened text).
## Labels never paint a stylebox, so the pill is a PanelContainer wrapped around the label.
static func chip(label: Label, color: Color, filled: bool = true) -> void:
	if label == null:
		return
	var host := label.get_parent() as PanelContainer
	if host == null or not str(host.name).begins_with("Chip"):
		host = PanelContainer.new()
		host.name = "Chip"
		host.mouse_filter = Control.MOUSE_FILTER_IGNORE
		host.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		var parent := label.get_parent()
		var idx := label.get_index()
		parent.remove_child(label)
		parent.add_child(host)
		parent.move_child(host, idx)
		host.add_child(label)
	var s := StyleBoxFlat.new()
	s.bg_color = Color(color.r, color.g, color.b, 0.16 if filled else 0.0)
	s.border_color = Color(color.r, color.g, color.b, 0.8)
	s.set_border_width_all(1)
	s.set_corner_radius_all(12)
	s.content_margin_left = 16
	s.content_margin_right = 16
	s.content_margin_top = 5
	s.content_margin_bottom = 5
	host.add_theme_stylebox_override("panel", s)
	label.add_theme_color_override("font_color", color.lightened(0.35))
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
