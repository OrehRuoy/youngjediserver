## Shared OptionButton + popup styling for table deck dropdowns.
class_name DropdownStyle
extends Object

const LIGHT_ACCENT := Color(0.25, 0.55, 0.95, 1)
const DARK_ACCENT := Color(0.85, 0.28, 0.28, 1)

static var _radio_on: Texture2D
static var _radio_off: Texture2D


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
	var on := _radio_texture(true)
	var off := _radio_texture(false)
	for icon_name in ["radio_checked", "checked", "radio_checked_disabled", "checked_disabled"]:
		popup.add_theme_icon_override(icon_name, on)
	for icon_name in ["radio_unchecked", "unchecked", "radio_unchecked_disabled", "unchecked_disabled"]:
		popup.add_theme_icon_override(icon_name, off)


## Gold dot when chosen, muted blue ring otherwise. Matches the lobby gold and navy.
static func _radio_texture(checked: bool) -> Texture2D:
	if checked and _radio_on != null:
		return _radio_on
	if not checked and _radio_off != null:
		return _radio_off
	var size := 18
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var center := (float(size) - 1.0) * 0.5
	var ring := Color(0.95, 0.82, 0.35, 1.0) if checked else Color(0.42, 0.56, 0.8, 0.95)
	var dot := Color(0.98, 0.88, 0.45, 1.0)
	for y in size:
		for x in size:
			var d := Vector2(float(x) - center, float(y) - center).length()
			var alpha := 0.0
			var color := ring
			if checked:
				var dot_a := _band(d, 0.0, 3.0)
				var ring_a := _band(d, 4.7, 6.7)
				if dot_a >= ring_a:
					alpha = dot_a
					color = dot
				else:
					alpha = ring_a
					color = ring
			else:
				alpha = _band(d, 4.7, 6.7)
			if alpha > 0.01:
				img.set_pixel(x, y, Color(color.r, color.g, color.b, alpha * color.a))
	var tex := ImageTexture.create_from_image(img)
	if checked:
		_radio_on = tex
	else:
		_radio_off = tex
	return tex


static func _band(d: float, inner: float, outer: float) -> float:
	var feather := 0.85
	if d < inner - feather or d > outer + feather:
		return 0.0
	if d < inner:
		return clampf((d - (inner - feather)) / feather, 0.0, 1.0)
	if d > outer:
		return clampf(((outer + feather) - d) / feather, 0.0, 1.0)
	return 1.0


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
