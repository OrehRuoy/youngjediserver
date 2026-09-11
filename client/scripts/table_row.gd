## Table row: table icon (white-glow / purple), host name, player count, and optional Join buttons.
extends PanelContainer

signal join_light_pressed
signal join_dark_pressed

const STYLE_CARD_LIGHT: StyleBox = preload("res://theme/lobby_table_card_light.tres")
const STYLE_CARD_DARK: StyleBox = preload("res://theme/lobby_table_card_dark.tres")

const COLOR_LIGHT_TINT := Color(0.92, 0.95, 1.0, 1)
const COLOR_DARK_TINT := Color(0.75, 0.5, 0.9, 1)
const COLOR_LIGHT_BTN_BG := Color(0.12, 0.15, 0.22, 0.92)
const COLOR_DARK_BTN_BG := Color(0.18, 0.08, 0.28, 0.92)

static var _icon_light: ImageTexture
static var _icon_dark: ImageTexture


static func _draw_ellipse(img: Image, cx: float, cy: float, rx: float, ry: float, col: Color, filled: bool = true) -> void:
	var s := img.get_size()
	var x0 := maxi(0, int(cx - rx) - 1)
	var x1 := mini(s.x - 1, int(cx + rx) + 1)
	var y0 := maxi(0, int(cy - ry) - 1)
	var y1 := mini(s.y - 1, int(cy + ry) + 1)
	for y in range(y0, y1 + 1):
		for x in range(x0, x1 + 1):
			var dx := (float(x) - cx) / rx
			var dy := (float(y) - cy) / ry
			var d := dx * dx + dy * dy
			if filled:
				if d <= 1.0:
					var edge := clampf(1.0 - (d - 0.85) / 0.15, 0.0, 1.0)
					var existing := img.get_pixel(x, y)
					var blended := Color(
						lerpf(existing.r, col.r, col.a * edge),
						lerpf(existing.g, col.g, col.a * edge),
						lerpf(existing.b, col.b, col.a * edge),
						clampf(existing.a + col.a * edge, 0.0, 1.0)
					)
					img.set_pixel(x, y, blended)
			else:
				if d >= 0.7 and d <= 1.3:
					var ring := 1.0 - absf(d - 1.0) / 0.3
					ring = clampf(ring, 0.0, 1.0)
					var existing := img.get_pixel(x, y)
					var blended := Color(
						lerpf(existing.r, col.r, col.a * ring),
						lerpf(existing.g, col.g, col.a * ring),
						lerpf(existing.b, col.b, col.a * ring),
						clampf(existing.a + col.a * ring, 0.0, 1.0)
					)
					img.set_pixel(x, y, blended)


static func _draw_rect_aa(img: Image, x0: int, y0: int, x1: int, y1: int, col: Color) -> void:
	var s := img.get_size()
	for y in range(maxi(0, y0), mini(s.y, y1 + 1)):
		for x in range(maxi(0, x0), mini(s.x, x1 + 1)):
			var existing := img.get_pixel(x, y)
			var blended := Color(
				lerpf(existing.r, col.r, col.a),
				lerpf(existing.g, col.g, col.a),
				lerpf(existing.b, col.b, col.a),
				clampf(existing.a + col.a, 0.0, 1.0)
			)
			img.set_pixel(x, y, blended)


static func _make_table_icon(base: Color, glow: Color, highlight: Color) -> ImageTexture:
	var sz := 64
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))

	# Outer glow halo
	_draw_ellipse(img, 32, 22, 30, 16, Color(glow.r, glow.g, glow.b, 0.12), true)
	_draw_ellipse(img, 32, 22, 26, 13, Color(glow.r, glow.g, glow.b, 0.15), true)

	# Table surface (filled ellipse)
	_draw_ellipse(img, 32, 22, 22, 10, Color(base.r * 0.35, base.g * 0.35, base.b * 0.35, 0.85), true)
	# Table rim (bright ring)
	_draw_ellipse(img, 32, 22, 22, 10, Color(glow.r, glow.g, glow.b, 0.9), false)
	# Inner highlight on surface
	_draw_ellipse(img, 32, 20, 14, 5, Color(highlight.r, highlight.g, highlight.b, 0.25), true)

	# Center pedestal
	_draw_rect_aa(img, 28, 28, 36, 46, Color(base.r * 0.4, base.g * 0.4, base.b * 0.4, 0.75))
	# Pedestal edge highlights
	_draw_rect_aa(img, 28, 28, 29, 46, Color(glow.r, glow.g, glow.b, 0.4))
	_draw_rect_aa(img, 35, 28, 36, 46, Color(glow.r, glow.g, glow.b, 0.25))

	# Base (wider ellipse at bottom)
	_draw_ellipse(img, 32, 48, 16, 5, Color(base.r * 0.3, base.g * 0.3, base.b * 0.3, 0.8), true)
	_draw_ellipse(img, 32, 48, 16, 5, Color(glow.r, glow.g, glow.b, 0.6), false)

	# Floor glow
	_draw_ellipse(img, 32, 52, 20, 6, Color(glow.r, glow.g, glow.b, 0.08), true)

	return ImageTexture.create_from_image(img)


static func _get_icon_light() -> ImageTexture:
	if not _icon_light:
		_icon_light = _make_table_icon(
			Color(0.7, 0.8, 0.95),
			Color(0.85, 0.9, 1.0),
			Color(1.0, 1.0, 1.0)
		)
	return _icon_light


static func _get_icon_dark() -> ImageTexture:
	if not _icon_dark:
		_icon_dark = _make_table_icon(
			Color(0.45, 0.2, 0.65),
			Color(0.65, 0.35, 0.9),
			Color(0.8, 0.55, 1.0)
		)
	return _icon_dark


func _ready() -> void:
	var join_light: Button = get_node_or_null("Margin/HBox/InfoVBox/Actions/JoinLight")
	var join_dark: Button = get_node_or_null("Margin/HBox/InfoVBox/Actions/JoinDark")
	if join_light:
		join_light.pressed.connect(func(): join_light_pressed.emit())
	if join_dark:
		join_dark.pressed.connect(func(): join_dark_pressed.emit())


func _style_button(btn: Button, is_light: bool) -> void:
	if not btn:
		return
	var style := StyleBoxFlat.new()
	style.bg_color = COLOR_LIGHT_BTN_BG if is_light else COLOR_DARK_BTN_BG
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.border_color = Color(0.7, 0.78, 0.95, 1) if is_light else Color(0.55, 0.3, 0.75, 1)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_right = 6
	style.corner_radius_bottom_left = 6
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	style.shadow_color = Color(0.7, 0.8, 1.0, 0.15) if is_light else Color(0.5, 0.2, 0.7, 0.15)
	style.shadow_size = 3
	btn.add_theme_stylebox_override("normal", style)
	var hover := style.duplicate() as StyleBoxFlat
	hover.bg_color = Color(0.18, 0.22, 0.3, 0.95) if is_light else Color(0.28, 0.12, 0.4, 0.95)
	hover.border_color = Color(0.85, 0.9, 1.0, 1) if is_light else Color(0.7, 0.45, 0.9, 1)
	hover.shadow_size = 5
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_color_override("font_color", COLOR_LIGHT_TINT if is_light else COLOR_DARK_TINT)


func set_table(t: Dictionary, state: RefCounted, is_playing: bool = false) -> void:
	var icon_rect: TextureRect = get_node_or_null("Margin/HBox/TableIcon")
	var game_lbl: Label = get_node_or_null("Margin/HBox/InfoVBox/NameRow/GameLabel")
	var count_lbl: Label = get_node_or_null("Margin/HBox/InfoVBox/NameRow/CountLabel")
	var join_light: Button = get_node_or_null("Margin/HBox/InfoVBox/Actions/JoinLight")
	var join_dark: Button = get_node_or_null("Margin/HBox/InfoVBox/Actions/JoinDark")
	var actions: Control = get_node_or_null("Margin/HBox/InfoVBox/Actions")
	if not game_lbl or not count_lbl:
		call_deferred("set_table", t, state, is_playing)
		return

	var host_side_light: bool = t.get("lightPlayerId", "") == t.get("hostId", "")

	add_theme_stylebox_override("panel", STYLE_CARD_LIGHT if host_side_light else STYLE_CARD_DARK)
	if icon_rect:
		icon_rect.texture = _get_icon_light() if host_side_light else _get_icon_dark()

	if game_lbl:
		game_lbl.add_theme_color_override("font_color", COLOR_LIGHT_TINT if host_side_light else COLOR_DARK_TINT)
	if count_lbl:
		count_lbl.add_theme_color_override("font_color", COLOR_LIGHT_TINT if host_side_light else COLOR_DARK_TINT)

	_style_button(join_light, true)
	_style_button(join_dark, false)

	var host_name: String = _player_name(state, t.get("hostId", ""))
	game_lbl.text = host_name if host_name != "—" else _game_number(t.get("id", ""))

	var light_filled: bool = not t.get("lightPlayerId", "").is_empty()
	var dark_filled: bool = not t.get("darkPlayerId", "").is_empty()
	var n: int = (1 if light_filled else 0) + (1 if dark_filled else 0)
	count_lbl.text = "👤 %d/2" % n

	if is_playing:
		if actions:
			actions.visible = false
		count_lbl.text = "👤 2/2"
		custom_minimum_size = Vector2(0, 50)
	else:
		if actions:
			actions.visible = true
		if join_light:
			join_light.visible = not light_filled
		if join_dark:
			join_dark.visible = not dark_filled


func _player_name(state: RefCounted, pid: String) -> String:
	if pid.is_empty():
		return "—"
	for p in state.players:
		if p.get("id", "") == pid:
			return p.get("name", "?")
	return "?"


func _game_number(table_id: String) -> String:
	if table_id.begins_with("table_"):
		return "Game #" + table_id.trim_prefix("table_")
	return "Game #" + table_id
