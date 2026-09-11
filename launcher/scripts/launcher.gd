## Young Jedi Launcher: fetches version from server, downloads game_data.pck when needed, then runs the game.
## Tries localhost first (for same-machine dev), then remote URL for everyone else.
## PCK download uses HTTPRequest + download_file (reliable HTTPS); raw HTTPClient+TLS often stalled with no progress.

extends Control

const VERSION_URL_LOCAL := "http://127.0.0.1:49152/updates/version.json"
const VERSION_URL_REMOTE := "https://youngjediserver.onrender.com/updates/version.json"
const GAME_SCENE := "res://scenes/login.tscn"
const GAME_WINDOW_WIDTH := 1280
const GAME_WINDOW_HEIGHT := 720
const GAME_WINDOW_MIN_WIDTH := 900
const GAME_WINDOW_MIN_HEIGHT := 600
const PCK_PATH := "user://game_data.pck"
const VERSION_PATH := "user://version.txt"
const LOCAL_TIMEOUT := 2.0
const REMOTE_TIMEOUT := 30.0
const DOWNLOAD_TIMEOUT_SEC := 600.0

@onready var status_label: Label = $VBox/Status
@onready var progress_bar: ProgressBar = $VBox/ProgressBar

var _version_request: HTTPRequest
var _download_http: HTTPRequest
var _download_url: String = ""
var _version_check_failed: bool = false
var _trying_local: bool = false
var _used_local_version: bool = false
var _server_pck_bytes: int = 0


func _ready() -> void:
	if progress_bar:
		progress_bar.visible = false
	_version_request = HTTPRequest.new()
	add_child(_version_request)
	_version_request.request_completed.connect(_on_version_request_completed)
	_check_version()


func _check_version() -> void:
	var dev_env := OS.get_environment("YOUNG_JEDI_DEV").to_lower()
	if (dev_env == "1" or dev_env == "true" or dev_env == "yes") and _has_pck():
		_set_status("Dev mode: skipping update check.")
		_run_game()
		return
	_set_status("Checking for updates...")
	# If you always run the game server locally, localhost version wins — bump local server/data/version.json + PCK too,
	# or set env YOUNG_JEDI_UPDATES_REMOTE_ONLY=1 to check the public URL first.
	var ro := OS.get_environment("YOUNG_JEDI_UPDATES_REMOTE_ONLY").to_lower()
	if ro == "1" or ro == "true" or ro == "yes":
		_try_remote_version()
		return
	_trying_local = true
	_version_request.timeout = LOCAL_TIMEOUT
	var err := _version_request.request(VERSION_URL_LOCAL)
	if err != OK:
		_trying_local = false
		_set_status("Failed to check for updates (error %d). Playing cached game." % err)
		_run_game()
		return


func _try_remote_version() -> void:
	_set_status("Checking for updates (remote)...")
	_trying_local = false
	_version_request.timeout = REMOTE_TIMEOUT
	var err := _version_request.request(VERSION_URL_REMOTE)
	if err != OK:
		_version_check_failed = true
		_set_status("Could not reach update server. Please run the standalone game or get game data from the developer.")
		_run_game()
		return


func _on_version_request_completed(result: int, _response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS:
		if _trying_local:
			_try_remote_version()
			return
		_version_check_failed = true
		_set_status("Could not reach update server (error %d). Playing cached game if available." % result)
		_run_game()
		return

	var json := JSON.new()
	var parse_err := json.parse(body.get_string_from_utf8())
	if parse_err != OK:
		if _trying_local:
			_try_remote_version()
			return
		_version_check_failed = true
		_set_status("Could not read version info. Playing cached game if available.")
		_run_game()
		return

	var data: Variant = json.get_data()
	if typeof(data) != TYPE_DICTIONARY:
		if _trying_local:
			_try_remote_version()
			return
		_version_check_failed = true
		_run_game()
		return

	_server_version = str(data.get("version", ""))
	_download_url = str(data.get("url", ""))
	_server_pck_bytes = int(data.get("pck_bytes", 0))
	if _trying_local:
		_used_local_version = true
	if _trying_local and not _download_url.is_empty():
		_download_url = _rewrite_url_to_localhost(_download_url)
	var local_version := _read_local_version()
	var server_version := _server_version

	if _download_url.is_empty():
		_version_check_failed = true
		_set_status("No download URL in version file. Please run the standalone game or get game data from the developer.")
		_run_game()
		return

	if _has_pck() and server_version == local_version:
		# Same version string but wrong/cached PCK (wrong URL, partial file, etc.) — re-download if size mismatches
		if _server_pck_bytes > 0:
			var lf := FileAccess.open(PCK_PATH, FileAccess.READ)
			var local_sz: int = int(lf.get_length()) if lf != null else -1
			if lf != null:
				lf.close()
			if local_sz == _server_pck_bytes:
				_set_status("Up to date. Starting game...")
				_run_game()
				return
			_set_status("Game data size mismatch — re-downloading…")
		else:
			_set_status("Up to date. Starting game...")
			_run_game()
			return

	_set_status("Downloading update…")
	_start_download()


func _set_progress_bar_visible(vis: bool) -> void:
	if progress_bar:
		progress_bar.visible = vis


func _rewrite_url_to_localhost(url: String) -> String:
	var scheme_end := url.find("://")
	if scheme_end < 0:
		return url
	var rest := url.substr(scheme_end + 3)
	var path_start := rest.find("/")
	var path_part := rest.substr(path_start) if path_start >= 0 else "/"
	# Always use http for localhost — the local server has no TLS certificate.
	return "http://127.0.0.1:49152" + path_part


func _read_local_version() -> String:
	if not FileAccess.file_exists(VERSION_PATH):
		return ""
	var f := FileAccess.open(VERSION_PATH, FileAccess.READ)
	if f == null:
		return ""
	var v := f.get_as_text().strip_edges()
	f.close()
	return v


func _has_pck() -> bool:
	return FileAccess.file_exists(PCK_PATH)


func _start_download() -> void:
	_set_progress_bar_visible(true)
	if progress_bar:
		progress_bar.value = 0.0
	if _download_http != null and is_instance_valid(_download_http):
		_download_http.queue_free()
	_download_http = HTTPRequest.new()
	add_child(_download_http)
	_download_http.timeout = DOWNLOAD_TIMEOUT_SEC
	_download_http.download_chunk_size = 65536
	var abs_pck := ProjectSettings.globalize_path(PCK_PATH)
	_download_http.download_file = abs_pck
	_download_http.request_completed.connect(_on_pck_download_completed)
	if _download_http.has_signal("download_progress"):
		_download_http.download_progress.connect(_on_pck_download_progress)
	var headers := PackedStringArray()
	headers.append("User-Agent: YoungJedi-Launcher/1.0")
	headers.append("Accept: */*")
	var err := _download_http.request(_download_url, headers, HTTPClient.METHOD_GET)
	if err != OK:
		_delete_pck_if_invalid()
		_download_failed("Could not start download (error %d)." % err)


func _on_pck_download_progress(bytes_done: int, total_bytes: int) -> void:
	if progress_bar == null:
		return
	if total_bytes > 0:
		progress_bar.value = clampf(float(bytes_done) / float(total_bytes), 0.0, 1.0)
		_set_status("Downloading update… %d%%" % int(progress_bar.value * 100.0))
	else:
		var mb := float(bytes_done) / (1024.0 * 1024.0)
		_set_status("Downloading update… %.1f MB" % mb)


func _on_pck_download_completed(result: int, response_code: int, _headers: PackedStringArray, _body: PackedByteArray) -> void:
	if _download_http != null and _download_http.request_completed.is_connected(_on_pck_download_completed):
		_download_http.request_completed.disconnect(_on_pck_download_completed)
	if result != HTTPRequest.RESULT_SUCCESS:
		_delete_pck_if_invalid()
		_download_failed("Download failed (error %d). Check internet or try again." % result)
		return
	if response_code < 200 or response_code >= 300:
		_delete_pck_if_invalid()
		_download_failed("Download server returned HTTP %d." % response_code)
		return
	if progress_bar:
		progress_bar.value = 1.0
	if not _is_valid_pck(PCK_PATH):
		_delete_pck()
		_set_progress_bar_visible(false)
		_set_status("Downloaded file is invalid. Run the launcher again to retry.")
		_run_game()
		return
	_save_version(_server_version)
	_set_status("Update complete. Starting game…")
	_set_progress_bar_visible(false)
	if _download_http != null:
		_download_http.queue_free()
		_download_http = null
	_run_game()


func _delete_pck_if_invalid() -> void:
	if FileAccess.file_exists(PCK_PATH) and not _is_valid_pck(PCK_PATH):
		_delete_pck()


var _server_version: String = ""


func _save_version(ver: String) -> void:
	var f := FileAccess.open(VERSION_PATH, FileAccess.WRITE)
	if f:
		f.store_string(ver)
		f.close()


func _download_failed(msg: String) -> void:
	if _download_http != null and is_instance_valid(_download_http):
		_download_http.queue_free()
		_download_http = null
	_set_progress_bar_visible(false)
	_set_status("%s If you have an older game copy, you can still play." % msg)
	_server_version = ""
	_run_game()


func _set_status(text: String) -> void:
	if status_label:
		status_label.text = text


func _is_valid_pck(path: String) -> bool:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null or f.get_length() < 4:
		return false
	var magic := f.get_buffer(4)
	f.close()
	return magic.size() >= 4 and magic[0] == 0x47 and magic[1] == 0x44 and magic[2] == 0x50 and magic[3] == 0x43


func _delete_pck() -> void:
	if FileAccess.file_exists(PCK_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(PCK_PATH))


func _apply_game_display_settings() -> void:
	ProjectSettings.set_setting("display/window/size/viewport_width", GAME_WINDOW_WIDTH)
	ProjectSettings.set_setting("display/window/size/viewport_height", GAME_WINDOW_HEIGHT)
	ProjectSettings.set_setting("display/window/size/min_width", GAME_WINDOW_MIN_WIDTH)
	ProjectSettings.set_setting("display/window/size/min_height", GAME_WINDOW_MIN_HEIGHT)
	ProjectSettings.set_setting("display/window/stretch/mode", "canvas_items")
	ProjectSettings.set_setting("display/window/stretch/aspect", "expand")
	var vp := get_viewport()
	var win := vp.get_window()
	if win:
		win.size = Vector2i(GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT)
		win.min_size = Vector2i(GAME_WINDOW_MIN_WIDTH, GAME_WINDOW_MIN_HEIGHT)
	vp.size = Vector2i(GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT)
	if "content_scale_size" in get_tree().root:
		get_tree().root.content_scale_size = Vector2i(GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT)
	get_tree().root.size = Vector2i(GAME_WINDOW_WIDTH, GAME_WINDOW_HEIGHT)


func _run_game() -> void:
	if not _has_pck():
		if not _version_check_failed:
			_set_status("No game data. Please run the standalone game or get game data from the developer.")
		return
	if not _is_valid_pck(PCK_PATH):
		_set_status("Game data file is corrupted or invalid. Run the launcher again to re-download.")
		_delete_pck()
		return
	## replace_files MUST be true: if false, anything already on res:// (launcher exe) wins over the pack — old/stub assets persist.
	var pck_abs := ProjectSettings.globalize_path(PCK_PATH)
	if not ProjectSettings.load_resource_pack(pck_abs, true):
		_set_status("Failed to load game data. The game may need to be re-exported with the same Godot version as the launcher.")
		return
	ProjectSettings.set_setting("application/config/use_local_server", true)
	var card_catalog = get_tree().root.get_node_or_null("CardCatalog")
	if card_catalog != null and card_catalog.has_method("_load_index"):
		card_catalog._load_index()
	_apply_game_display_settings()
	if get_tree().change_scene_to_file(GAME_SCENE) != OK:
		_set_status("Failed to start game scene.")
