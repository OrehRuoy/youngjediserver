## Lobby scene: live tables, playing tables, online players, NEWS, COMMS FEED.
## Matches the mockup layout: Row 1 (player + online), Row 2 (live tables + news + buttons), Row 3 (playing + comms).

extends Control

# --- Row 1: Player info + Online panel ---
@onready var avatar_rect: TextureRect = $Margin/Rows/TopRow/PlayerPanel/PlayerHBox/AvatarRect
@onready var player_name_label: Label = $Margin/Rows/TopRow/PlayerPanel/PlayerHBox/NameVBox/PlayerNameLabel
@onready var online_label: Label = $Margin/Rows/TopRow/PlayerPanel/PlayerHBox/NameVBox/OnlineLabel
@onready var logout_btn: Button = $Margin/Rows/TopRow/OnlinePanel/OnlineMargin/OnlineVBox/TitleRow/LogoutBtn
@onready var players_container: VBoxContainer = $Margin/Rows/TopRow/OnlinePanel/OnlineMargin/OnlineVBox/PlayersScroll/PlayersList

# --- Row 2: Live tables + News + Buttons ---
@onready var tables_container: VBoxContainer = $Margin/Rows/MiddleRow/LiveTablesPanel/LiveVBox/LiveScroll/TablesList
@onready var news_content: RichTextLabel = $Margin/Rows/MiddleRow/NewsPanel/NewsMargin/NewsVBox/NewsContent
@onready var buttons_column: VBoxContainer = $Margin/Rows/MiddleRow/ButtonsColumn
@onready var create_light_btn: Button = $Margin/Rows/MiddleRow/ButtonsColumn/CreateLight
@onready var create_dark_btn: Button = $Margin/Rows/MiddleRow/ButtonsColumn/CreateDark
@onready var bot_game_btn: Button = $Margin/Rows/MiddleRow/ButtonsColumn/BotGameBtn
@onready var deckbuilder_btn: Button = $Margin/Rows/MiddleRow/ButtonsColumn/DeckbuilderBtn
@onready var rules_btn: Button = $Margin/Rows/MiddleRow/ButtonsColumn/RulesBtn
@onready var report_bug_btn: Button = $Margin/Rows/MiddleRow/ButtonsColumn/ReportBugBtn

# --- Row 3: Playing tables + Comms ---
@onready var playing_tables_container: VBoxContainer = $Margin/Rows/BottomRow/PlayingPanel/PlayingVBox/PlayingScroll/PlayingTablesList
@onready var chat_log: RichTextLabel = $Margin/Rows/BottomRow/CommsPanel/CommsVBox/ChatLog
@onready var chat_edit: LineEdit = $Margin/Rows/BottomRow/CommsPanel/CommsVBox/ChatRow/ChatEdit
@onready var chat_btn: Button = $Margin/Rows/BottomRow/CommsPanel/CommsVBox/ChatRow/SendBtn

const LOGIN_SAVE_PATH := "user://young_jedi_login.cfg"

var _table_row_scene: PackedScene
var _reconnecting: bool = false
var _player_avatar_tex: Texture2D
var _bot_avatar_tex: Texture2D
var _logout_cooldown: float = 0.5  # brief guard against stray input from login screen
var _chat_send_frame: int = -1


func _ready() -> void:
	_table_row_scene = preload("res://scenes/table_row.tscn")
	_player_avatar_tex = load("res://assets/bot_avatar.png") as Texture2D
	_bot_avatar_tex = load("res://assets/bot_avatar.png") as Texture2D

	# Set player avatar
	if avatar_rect and _player_avatar_tex:
		avatar_rect.texture = _player_avatar_tex

	var client: RefCounted = Connection.get_client()
	var state: RefCounted = Connection.get_state()
	if state.player_name and not client.is_connected_to_server():
		_reconnecting = true
		client.connect_to_server(Connection.get_server_url())
		online_label.text = "• Reconnecting..."
	client.message_received.connect(_on_message)
	client.connected.connect(_on_connected)
	client.disconnected.connect(_on_disconnected)
	state.lobby_updated.connect(_on_lobby_updated)
	state.chat_received.connect(_on_chat)
	state.error_received.connect(_on_error)
	logout_btn.pressed.connect(_on_logout_pressed)
	chat_btn.pressed.connect(_on_chat_sent)
	if chat_edit:
		chat_edit.text_submitted.connect(_on_chat_submitted)
		chat_edit.gui_input.connect(_on_chat_edit_gui_input)
	create_light_btn.pressed.connect(_on_create_light)
	create_dark_btn.pressed.connect(_on_create_dark)
	bot_game_btn.pressed.connect(_on_bot_game_pressed)
	deckbuilder_btn.pressed.connect(_on_deckbuilder_pressed)
	rules_btn.pressed.connect(_on_rules_pressed)
	if report_bug_btn:
		report_bug_btn.pressed.connect(_on_report_bug_pressed)
	_setup_bot_game_icon()
	_update_ui()
	_build_players_list()
	_build_tables_list()


func _setup_bot_game_icon() -> void:
	if _bot_avatar_tex and bot_game_btn:
		bot_game_btn.icon = _bot_avatar_tex
		bot_game_btn.expand_icon = true
		bot_game_btn.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_style_side_button(create_light_btn, true)
	_style_side_button(create_dark_btn, false)
	_setup_deckbuilder_icon()
	_setup_rules_icon()
	_setup_report_bug_icon()


func _setup_deckbuilder_icon() -> void:
	if not deckbuilder_btn:
		return
	var tex := _make_cards_icon(Color(0.7, 0.8, 0.95))
	deckbuilder_btn.icon = tex
	deckbuilder_btn.expand_icon = true
	deckbuilder_btn.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT


func _setup_rules_icon() -> void:
	if not rules_btn:
		return
	var tex := _make_book_icon(Color(0.7, 0.8, 0.95))
	rules_btn.icon = tex
	rules_btn.expand_icon = true
	rules_btn.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT


func _setup_report_bug_icon() -> void:
	if not report_bug_btn:
		return
	var tex := _make_bug_icon(Color(0.7, 0.8, 0.95))
	report_bug_btn.icon = tex
	report_bug_btn.expand_icon = true
	report_bug_btn.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT


static func _make_cards_icon(tint: Color) -> ImageTexture:
	var sz := 24
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	# Back card (offset)
	for y in range(2, 18):
		for x in range(6, 18):
			var edge := mini(mini(x - 6, 17 - x), mini(y - 2, 17 - y))
			if edge == 0:
				img.set_pixel(x, y, Color(tint.r, tint.g, tint.b, 0.7))
			elif edge <= 1:
				img.set_pixel(x, y, Color(tint.r * 0.3, tint.g * 0.3, tint.b * 0.3, 0.35))
	# Front card (on top)
	for y in range(5, 22):
		for x in range(3, 15):
			var edge := mini(mini(x - 3, 14 - x), mini(y - 5, 21 - y))
			if edge == 0:
				img.set_pixel(x, y, Color(tint.r, tint.g, tint.b, 0.9))
			elif edge <= 1:
				img.set_pixel(x, y, Color(tint.r * 0.5, tint.g * 0.5, tint.b * 0.5, 0.55))
			else:
				img.set_pixel(x, y, Color(tint.r * 0.15, tint.g * 0.15, tint.b * 0.15, 0.5))
	# Small line details on front card
	for x in range(5, 13):
		img.set_pixel(x, 9, Color(tint.r * 0.6, tint.g * 0.6, tint.b * 0.6, 0.4))
		img.set_pixel(x, 12, Color(tint.r * 0.6, tint.g * 0.6, tint.b * 0.6, 0.3))
	return ImageTexture.create_from_image(img)


static func _make_book_icon(tint: Color) -> ImageTexture:
	var sz := 24
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	# Book body
	for y in range(3, 21):
		for x in range(4, 20):
			var edge := mini(mini(x - 4, 19 - x), mini(y - 3, 20 - y))
			if edge == 0:
				img.set_pixel(x, y, Color(tint.r, tint.g, tint.b, 0.85))
			elif edge <= 1:
				img.set_pixel(x, y, Color(tint.r * 0.4, tint.g * 0.4, tint.b * 0.4, 0.5))
			else:
				img.set_pixel(x, y, Color(tint.r * 0.12, tint.g * 0.12, tint.b * 0.12, 0.45))
	# Spine
	for y in range(3, 21):
		img.set_pixel(4, y, Color(tint.r * 0.8, tint.g * 0.8, tint.b * 0.8, 0.9))
		img.set_pixel(5, y, Color(tint.r * 0.6, tint.g * 0.6, tint.b * 0.6, 0.7))
	# Text lines
	for x in range(7, 17):
		img.set_pixel(x, 7, Color(tint.r * 0.7, tint.g * 0.7, tint.b * 0.7, 0.45))
		img.set_pixel(x, 10, Color(tint.r * 0.6, tint.g * 0.6, tint.b * 0.6, 0.35))
		img.set_pixel(x, 13, Color(tint.r * 0.6, tint.g * 0.6, tint.b * 0.6, 0.35))
	for x in range(7, 14):
		img.set_pixel(x, 16, Color(tint.r * 0.5, tint.g * 0.5, tint.b * 0.5, 0.3))
	return ImageTexture.create_from_image(img)


static func _make_bug_icon(tint: Color) -> ImageTexture:
	var sz := 24
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var body := Color(tint.r, tint.g, tint.b, 0.9)
	var dim := Color(tint.r * 0.55, tint.g * 0.55, tint.b * 0.55, 0.7)
	# Body oval
	for y in range(7, 19):
		for x in range(8, 16):
			var dx := absf(x - 11.5) / 3.5
			var dy := absf(y - 12.5) / 5.5
			if dx * dx + dy * dy <= 1.0:
				img.set_pixel(x, y, body if dx * dx + dy * dy > 0.55 else Color(tint.r * 0.18, tint.g * 0.18, tint.b * 0.18, 0.55))
	# Head
	for y in range(4, 9):
		for x in range(9, 15):
			var dx := absf(x - 11.5) / 2.6
			var dy := absf(y - 6.0) / 2.2
			if dx * dx + dy * dy <= 1.0:
				img.set_pixel(x, y, body)
	# Antennae
	img.set_pixel(9, 3, dim)
	img.set_pixel(8, 2, dim)
	img.set_pixel(14, 3, dim)
	img.set_pixel(15, 2, dim)
	# Legs
	for i in range(3):
		var ly := 9 + i * 3
		img.set_pixel(6, ly, dim)
		img.set_pixel(5, ly + 1, dim)
		img.set_pixel(17, ly, dim)
		img.set_pixel(18, ly + 1, dim)
	return ImageTexture.create_from_image(img)


func _style_side_button(btn: Button, is_light: bool) -> void:
	if not btn:
		return
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.12, 0.2, 0.9) if is_light else Color(0.18, 0.06, 0.28, 0.9)
	style.border_width_left = 2
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.border_color = Color(0.7, 0.78, 0.95, 1) if is_light else Color(0.55, 0.3, 0.75, 1)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_right = 6
	style.corner_radius_bottom_left = 6
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	style.shadow_color = Color(0.6, 0.7, 0.9, 0.18) if is_light else Color(0.4, 0.15, 0.6, 0.18)
	style.shadow_size = 4
	btn.add_theme_stylebox_override("normal", style)
	var hover := style.duplicate() as StyleBoxFlat
	hover.bg_color = Color(0.16, 0.2, 0.3, 0.95) if is_light else Color(0.25, 0.1, 0.38, 0.95)
	hover.border_color = Color(0.85, 0.9, 1.0, 1) if is_light else Color(0.7, 0.45, 0.9, 1)
	hover.shadow_size = 6
	btn.add_theme_stylebox_override("hover", hover)
	var tint := Color(0.92, 0.95, 1.0, 1) if is_light else Color(0.75, 0.5, 0.9, 1)
	btn.add_theme_color_override("font_color", tint)


func _process(delta: float) -> void:
	Connection.get_client().poll()
	if _logout_cooldown > 0:
		_logout_cooldown -= delta


func _connect_if_needed() -> void:
	if not Connection.get_client().is_connected_to_server():
		Connection.get_client().connect_to_server(Connection.get_server_url())
		online_label.text = "• Connecting..."


func _on_logout_pressed() -> void:
	if _logout_cooldown > 0:
		return
	_clear_saved_login()
	Connection.get_client().disconnect_from_server()
	get_tree().change_scene_to_file("res://scenes/login.tscn")


func _clear_saved_login() -> void:
	if FileAccess.file_exists(LOGIN_SAVE_PATH):
		DirAccess.remove_absolute(LOGIN_SAVE_PATH)


func _on_message(msg: Dictionary) -> void:
	Connection.get_state().apply_message(msg)
	if msg.get("type", "") == "table_update":
		var table: Dictionary = msg.get("table", {})
		if not table.is_empty() and Connection.get_state().current_table_id != "":
			get_tree().change_scene_to_file("res://scenes/waiting_room.tscn")


func _on_connected() -> void:
	if _reconnecting:
		_reconnecting = false
		Connection.get_client().login(Connection.get_state().player_name)
		online_label.text = "• Reconnecting..."
	else:
		online_label.text = "• ONLINE"


func _on_disconnected() -> void:
	online_label.text = "• Disconnected"
	online_label.add_theme_color_override("font_color", Color(0.8, 0.3, 0.3, 1))
	Connection.get_state().logged_in = false
	_update_ui()


func _on_chat_sent() -> void:
	_send_lobby_chat(chat_edit.text)


func _on_chat_submitted(new_text: String) -> void:
	_send_lobby_chat(new_text)


func _on_chat_edit_gui_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	if event.keycode != KEY_ENTER and event.keycode != KEY_KP_ENTER:
		return
	_send_lobby_chat(chat_edit.text)
	chat_edit.accept_event()


func _send_lobby_chat(raw: String) -> void:
	var text: String = raw.strip_edges()
	if text.is_empty():
		return
	var frame: int = Engine.get_process_frames()
	if frame == _chat_send_frame:
		return
	_chat_send_frame = frame
	Connection.get_client().lobby_chat(text)
	chat_edit.clear()
	chat_edit.grab_focus()


func _on_chat(from: String, text: String, _at: int) -> void:
	chat_log.append_text("[color=gray][%s][/color] %s: %s\n" % [Time.get_time_string_from_system(), from, text])


func _on_error(msg: String) -> void:
	online_label.text = "• Error"
	online_label.add_theme_color_override("font_color", Color(0.9, 0.4, 0.3, 1))


func _player_name(pid: String) -> String:
	if pid.is_empty():
		return "—"
	var state: RefCounted = Connection.get_state()
	for p in state.players:
		if p.get("id", "") == pid:
			return p.get("name", "?")
	return "?"


func _on_lobby_updated() -> void:
	_update_ui()
	_build_players_list()
	_build_tables_list()


func _build_players_list() -> void:
	for c in players_container.get_children():
		c.queue_free()
	var state: RefCounted = Connection.get_state()
	var show_self: bool = state.logged_in
	for p in state.players:
		if p.get("id", "") == state.player_id:
			show_self = false
		_add_player_entry(p.get("name", "?"), p.get("tableId", "") != "")
	if show_self:
		_add_player_entry(state.player_name, false)


func _add_player_entry(pname: String, in_game: bool) -> void:
	var row: HBoxContainer = HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)

	var icon: TextureRect = TextureRect.new()
	icon.custom_minimum_size = Vector2(20, 20)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if _player_avatar_tex:
		icon.texture = _player_avatar_tex
	row.add_child(icon)

	var lbl: Label = Label.new()
	lbl.text = pname
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(lbl)

	if in_game:
		var tag: Label = Label.new()
		tag.text = "In Game"
		tag.add_theme_color_override("font_color", Color(0.3, 0.85, 0.5, 1))
		tag.add_theme_font_size_override("font_size", 12)
		row.add_child(tag)

	players_container.add_child(row)


func _build_tables_list() -> void:
	for c in tables_container.get_children():
		c.queue_free()
	for c in playing_tables_container.get_children():
		c.queue_free()
	var state: RefCounted = Connection.get_state()
	for t in state.tables:
		var row: Control = _table_row_scene.instantiate()
		var started: bool = t.get("gameStarted", false)
		if started:
			playing_tables_container.add_child(row)
		else:
			tables_container.add_child(row)
			row.join_light_pressed.connect(_on_join_light.bind(t))
			row.join_dark_pressed.connect(_on_join_dark.bind(t))
		row.set_table(t, state, started)


func _on_create_light() -> void:
	_connect_if_needed()
	if not Connection.get_state().logged_in:
		return
	Connection.get_client().table_create("light")
	Connection.get_state().my_side = "light"


func _on_create_dark() -> void:
	_connect_if_needed()
	if not Connection.get_state().logged_in:
		return
	Connection.get_client().table_create("dark")
	Connection.get_state().my_side = "dark"


func _on_bot_game_pressed() -> void:
	_connect_if_needed()
	if not Connection.get_state().logged_in:
		return
	get_tree().change_scene_to_file("res://scenes/bot_waiting_room.tscn")


func _on_deckbuilder_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/deckbuilder.tscn")


func _on_rules_pressed() -> void:
	OS.shell_open("https://www.starwarsccg.org/young-jedi/")


func _on_report_bug_pressed() -> void:
	var to_addr := "brock.hall1985@gmail.com"
	var subject := "Young Jedi Server bug report"
	OS.shell_open("mailto:%s?subject=%s" % [to_addr, subject.uri_encode()])


func _on_join_light(table: Dictionary) -> void:
	Connection.get_client().table_join(table.get("id", ""), "light")
	Connection.get_state().my_side = "light"


func _on_join_dark(table: Dictionary) -> void:
	Connection.get_client().table_join(table.get("id", ""), "dark")
	Connection.get_state().my_side = "dark"


func _update_ui() -> void:
	var state: GameState = Connection.get_state()
	buttons_column.visible = state.logged_in
	if news_content:
		news_content.bbcode_enabled = true
		news_content.text = state.news_text
	if state.logged_in and state.current_table_id == "":
		player_name_label.text = state.player_name
		if Connection.get_client().is_connected_to_server():
			online_label.text = "• ONLINE"
			online_label.add_theme_color_override("font_color", Color(0.3, 0.85, 0.3, 1))
		else:
			online_label.text = "• Disconnected"
			online_label.add_theme_color_override("font_color", Color(0.8, 0.3, 0.3, 1))
	elif not state.logged_in:
		player_name_label.text = ""
		online_label.text = "• Disconnected"
		online_label.add_theme_color_override("font_color", Color(0.8, 0.3, 0.3, 1))
