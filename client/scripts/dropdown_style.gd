## Shared OptionButton + popup styling for table deck dropdowns.
class_name DropdownStyle
extends Object

const LIGHT_ACCENT := Color(0.25, 0.55, 0.95, 1)
const DARK_ACCENT := Color(0.85, 0.28, 0.28, 1)


static func apply(btn: OptionButton, accent: Color, host_theme: Theme = null) -> void:
	if btn == null:
		return
	var fill := Color(0.04, 0.06, 0.14, 0.96)
	if accent.r > accent.b:
		fill = Color(0.12, 0.04, 0.05, 0.96)
	btn.add_theme_stylebox_override("normal", _box(fill, accent))
	btn.add_theme_stylebox_override("hover", _box(fill.lightened(0.08), accent.lightened(0.15)))
	btn.add_theme_stylebox_override("pressed", _box(fill.darkened(0.08), accent.darkened(0.12)))
	btn.add_theme_stylebox_override("hover_pressed", _box(fill.darkened(0.08), accent.darkened(0.12)))
	btn.add_theme_stylebox_override("focus", _box(fill.lightened(0.08), accent.lightened(0.15)))
	btn.add_theme_stylebox_override("disabled", _box(Color(fill.r, fill.g, fill.b, 0.72), Color(accent.r, accent.g, accent.b, 0.35)))
	btn.add_theme_color_override("font_color", Color(0.92, 0.94, 1, 1))
	btn.add_theme_color_override("font_hover_color", Color(0.98, 0.9, 0.5, 1))
	btn.add_theme_color_override("font_pressed_color", Color(0.95, 0.82, 0.35, 1))
	btn.add_theme_color_override("font_focus_color", Color(0.98, 0.9, 0.5, 1))
	btn.add_theme_color_override("font_disabled_color", Color(0.58, 0.6, 0.68, 0.85))
	var popup := btn.get_popup()
	if host_theme:
		popup.theme = host_theme
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color(fill.r, fill.g, fill.b, 0.98)
	panel.border_color = accent
	panel.set_border_width_all(1)
	panel.set_corner_radius_all(8)
	panel.set_content_margin_all(6)
	panel.shadow_color = Color(0, 0, 0, 0.5)
	panel.shadow_size = 10
	panel.shadow_offset = Vector2(0, 4)
	popup.add_theme_stylebox_override("panel", panel)
	var hover := StyleBoxFlat.new()
	hover.bg_color = Color(accent.r, accent.g, accent.b, 0.32)
	hover.border_width_left = 3
	hover.border_color = Color(0.95, 0.82, 0.35, 1)
	hover.set_corner_radius_all(4)
	hover.content_margin_left = 10
	hover.content_margin_top = 7
	hover.content_margin_right = 10
	hover.content_margin_bottom = 7
	popup.add_theme_stylebox_override("hover", hover)
	popup.add_theme_color_override("font_color", Color(0.9, 0.92, 1, 1))
	popup.add_theme_color_override("font_hover_color", Color(0.98, 0.92, 0.55, 1))
	popup.add_theme_color_override("font_disabled_color", Color(0.5, 0.55, 0.65, 0.8))
	popup.add_theme_font_size_override("font_size", 14)
	popup.add_theme_constant_override("v_separation", 4)
	popup.add_theme_constant_override("item_start_padding", 8)
	popup.add_theme_constant_override("item_end_padding", 8)


static func _box(bg: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(1)
	s.set_corner_radius_all(6)
	s.content_margin_left = 10
	s.content_margin_top = 6
	s.content_margin_right = 10
	s.content_margin_bottom = 6
	return s
