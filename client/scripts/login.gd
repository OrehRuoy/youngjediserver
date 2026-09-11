## Login scene: enter name, optional "Stay logged in", then go to lobby.

extends Control

const SAVE_PATH := "user://young_jedi_login.cfg"
const SECTION := "login"
const WAKE_RETRY_SEC := 90.0
const WAKE_RETRY_INTERVAL := 3.0

var name_edit: LineEdit
var stay_logged_in_cb: CheckBox
var login_btn: Button
var status_label: Label
var server_status_label: Label
var server_status_pill: PanelContainer

var pending_login_name: String = ""
var _local_fallback_timer: float = -1.0  # when > 0, count down then try remote
var _wake_remaining: float = -1.0
var _wake_cooldown: float = 0.0
var _wake_url: String = ""


func _ready() -> void:
	login_btn = find_child("LoginBtn", true, false) as Button
	name_edit = find_child("NameEdit", true, false) as LineEdit
	stay_logged_in_cb = find_child("StayLoggedIn", true, false) as CheckBox
	status_label = find_child("StatusLabel", true, false) as Label
	server_status_pill = find_child("ServerStatusPill", true, false) as PanelContainer
	server_status_label = find_child("ServerStatus", true, false) as Label
	if login_btn == null or name_edit == null or status_label == null:
		push_error("Login scene missing LoginBtn, NameEdit, or StatusLabel.")
		return
	var client: RefCounted = Connection.get_client()
	var state: RefCounted = Connection.get_state()
	client.message_received.connect(_on_message)
	client.connected.connect(_on_connected)
	client.disconnected.connect(_on_disconnected)
	state.error_received.connect(_on_error)
	login_btn.pressed.connect(_on_login_pressed)
	login_btn.button_down.connect(_on_login_btn_down)
	login_btn.button_up.connect(_on_login_btn_up)
	login_btn.mouse_entered.connect(_on_login_btn_hover)
	login_btn.mouse_exited.connect(_on_login_btn_unhover)
	_load_saved()
	_update_server_status()
	# If we have stay-logged-in + name, we'll auto-login once connected
	if stay_logged_in_cb != null and stay_logged_in_cb.button_pressed and not name_edit.text.strip_edges().is_empty():
		pending_login_name = name_edit.text.strip_edges()
		status_label.text = "Connecting..."
	else:
		status_label.text = "Enter your name to join"
	var server_url := _get_server_url()
	if OS.has_feature("web"):
		status_label.text = "Web: connecting to %s …" % server_url
	if not Connection.get_client().is_connected_to_server():
		Connection.get_client().connect_to_server(server_url)
		_begin_wake_if_remote(server_url)


var _web_debug_label: Label = null

func _process(delta: float) -> void:
	Connection.get_client().poll()
	if OS.has_feature("web"):
		var client = Connection.get_client()
		var log_text: String = client.get("web_debug_log") if client.get("web_debug_log") != null else ""
		if not log_text.is_empty():
			if _web_debug_label == null:
				_web_debug_label = Label.new()
				_web_debug_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
				_web_debug_label.offset_top = -120
				_web_debug_label.add_theme_font_size_override("font_size", 10)
				_web_debug_label.add_theme_color_override("font_color", Color(0.5, 1.0, 0.5, 0.9))
				_web_debug_label.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
				add_child(_web_debug_label)
			_web_debug_label.text = log_text
	if _local_fallback_timer > 0:
		_local_fallback_timer -= delta
		if _local_fallback_timer <= 0:
			_local_fallback_timer = -1.0
			Connection.switch_to_remote_server()
			var remote_url := Connection.get_server_url()
			Connection.get_client().connect_to_server(remote_url)
			_begin_wake_if_remote(remote_url)
			status_label.text = "Trying remote server..."
	_tick_wake_retry(delta)


func _get_server_url() -> String:
	return Connection.get_server_url()


func _is_remote_url(url: String) -> bool:
	if url.begins_with("wss://"):
		return true
	return not url.contains("127.0.0.1") and not url.contains("localhost")


func _begin_wake_if_remote(url: String) -> void:
	if not _is_remote_url(url):
		return
	_wake_url = url
	if _wake_remaining <= 0:
		_wake_remaining = WAKE_RETRY_SEC
	_wake_cooldown = WAKE_RETRY_INTERVAL


func _tick_wake_retry(delta: float) -> void:
	if _wake_remaining <= 0:
		return
	var client: RefCounted = Connection.get_client()
	if client.is_connected_to_server():
		_wake_remaining = -1.0
		return
	_wake_remaining -= delta
	_wake_cooldown -= delta
	if status_label != null:
		var secs: int = maxi(ceili(_wake_remaining), 0)
		status_label.text = "Waking server… about %d seconds left" % secs
	if _wake_remaining <= 0:
		_wake_remaining = -1.0
		if status_label != null:
			status_label.text = "Server did not wake. Wait a minute and try Login again."
		_update_server_status()
		return
	if _wake_cooldown <= 0 and not client.is_connecting():
		client.connect_to_server(_wake_url)
		_wake_cooldown = WAKE_RETRY_INTERVAL


func _load_saved() -> void:
	var cfg := ConfigFile.new()
	if FileAccess.file_exists(SAVE_PATH):
		var err := cfg.load(SAVE_PATH)
		if err == OK and stay_logged_in_cb != null:
			stay_logged_in_cb.button_pressed = cfg.get_value(SECTION, "stay_logged_in", false)
			var saved_name: String = cfg.get_value(SECTION, "player_name", "")
			if not saved_name.is_empty():
				name_edit.text = saved_name


func _save_if_stay_logged_in(name_text: String) -> void:
	if stay_logged_in_cb != null and stay_logged_in_cb.button_pressed:
		var cfg := ConfigFile.new()
		cfg.set_value(SECTION, "stay_logged_in", true)
		cfg.set_value(SECTION, "player_name", name_text)
		cfg.save(SAVE_PATH)
	else:
		_clear_saved()


func _clear_saved() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		var cfg := ConfigFile.new()
		if cfg.load(SAVE_PATH) == OK:
			cfg.set_value(SECTION, "stay_logged_in", false)
			cfg.set_value(SECTION, "player_name", "")
			cfg.save(SAVE_PATH)


const BTN_SCALE_NORMAL := Vector2(1.0, 1.0)
const BTN_SCALE_HOVER := Vector2(1.05, 1.05)
const BTN_SCALE_PRESSED := Vector2(0.96, 0.96)
const BTN_MOD_NORMAL := Color(1.0, 1.0, 1.0)
const BTN_MOD_HOVER := Color(1.08, 1.1, 1.22)   # slight brightening + blue glow
const BTN_MOD_PRESSED := Color(0.78, 0.82, 0.98)  # dimmed, pressed-in look
const BTN_TWEEN_DURATION := 0.08


func _tween_btn_scale_mod(scale_to: Vector2, mod_to: Color) -> void:
	if login_btn == null:
		return
	var t := create_tween()
	t.set_ease(Tween.EASE_OUT)
	t.set_trans(Tween.TRANS_QUAD)
	t.set_parallel(true)
	t.tween_property(login_btn, "scale", scale_to, BTN_TWEEN_DURATION)
	t.tween_property(login_btn, "modulate", mod_to, BTN_TWEEN_DURATION)


func _on_login_btn_down() -> void:
	_tween_btn_scale_mod(BTN_SCALE_PRESSED, BTN_MOD_PRESSED)


func _on_login_btn_up() -> void:
	if login_btn.is_hovered():
		_tween_btn_scale_mod(BTN_SCALE_HOVER, BTN_MOD_HOVER)
	else:
		_tween_btn_scale_mod(BTN_SCALE_NORMAL, BTN_MOD_NORMAL)


func _on_login_btn_hover() -> void:
	if login_btn == null:
		return
	if login_btn.button_pressed:
		return
	_tween_btn_scale_mod(BTN_SCALE_HOVER, BTN_MOD_HOVER)


func _on_login_btn_unhover() -> void:
	_tween_btn_scale_mod(BTN_SCALE_NORMAL, BTN_MOD_NORMAL)


func _on_login_pressed() -> void:
	var name_text: String = name_edit.text.strip_edges()
	if name_text.is_empty():
		status_label.text = "Enter a name"
		return
	_save_if_stay_logged_in(name_text)
	if not Connection.get_client().is_connected_to_server():
		pending_login_name = name_text
		var url := _get_server_url()
		Connection.get_client().connect_to_server(url)
		_begin_wake_if_remote(url)
		status_label.text = "Connecting..."
		return
	Connection.get_client().login(name_text)
	status_label.text = "Logging in..."


func _on_message(msg: Dictionary) -> void:
	Connection.get_state().apply_message(msg)
	if msg.get("type", "") == "login_result":
		if msg.get("ok", false):
			status_label.text = "Online as %s" % msg.get("name", "")
			get_tree().change_scene_to_file("res://scenes/main.tscn")
		else:
			status_label.text = msg.get("error", "Login failed")


func _on_connected() -> void:
	_local_fallback_timer = -1.0  # cancel fallback to remote
	_wake_remaining = -1.0
	_update_server_status()
	status_label.text = "Connected"
	if not pending_login_name.is_empty():
		Connection.get_client().login(pending_login_name)
		status_label.text = "Logging in..."
		pending_login_name = ""


func _on_disconnected() -> void:
	_update_server_status()
	status_label.text = "Disconnected"
	Connection.get_state().logged_in = false
	# When launcher set use_local_server, try remote after a short delay (for testers without local server)
	if ProjectSettings.get_setting("application/config/use_local_server", false) and _local_fallback_timer < 0:
		_local_fallback_timer = 2.0


func _update_server_status() -> void:
	if server_status_pill == null or server_status_label == null:
		return
	var online: bool = Connection.get_client().is_connected_to_server()
	var pill_style := StyleBoxFlat.new()
	pill_style.bg_color = Color(0.06, 0.14, 0.1, 0.95) if online else Color(0.18, 0.08, 0.08, 0.95)
	pill_style.border_color = Color(0.2, 0.7, 0.35, 1) if online else Color(0.75, 0.25, 0.2, 1)
	pill_style.set_corner_radius_all(14)
	pill_style.set_content_margin_all(6)
	pill_style.set_border_width_all(1)
	server_status_pill.add_theme_stylebox_override("panel", pill_style)
	if online:
		server_status_label.text = "Server Online"
		server_status_label.add_theme_color_override("font_color", Color(0.4, 0.95, 0.5))
	else:
		server_status_label.text = "Server Offline"
		server_status_label.add_theme_color_override("font_color", Color(0.95, 0.35, 0.3))


func _on_error(msg: String) -> void:
	status_label.text = "Error: %s" % msg
