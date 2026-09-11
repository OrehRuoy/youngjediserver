## WebSocket client for Young Jedi TCG server.
## Web export: uses JavaScriptBridge.create_object("WebSocket") to create a real browser WebSocket.
## No eval, no custom <script> tags, no CSP issues — works on itch.io.
class_name NetworkClient
extends RefCounted

signal connected()
signal disconnected()
signal message_received(msg: Dictionary)

const DEFAULT_URL := "wss://mnbsekfunp.localto.net"
const HEARTBEAT_MS := 25000

var _ws: WebSocketPeer
var _url: String = DEFAULT_URL
var _connected: bool = false
var _last_heartbeat_ms: int = 0

var _js_ws: Variant
var _js_open_cb: Variant
var _js_msg_cb: Variant
var _js_close_cb: Variant
var _js_err_cb: Variant
var _browser_queue: PackedStringArray = PackedStringArray()


func _init() -> void:
	if not _is_web():
		_ws = WebSocketPeer.new()


func _is_web() -> bool:
	return OS.has_feature("web")


func connect_to_server(url: String = DEFAULT_URL) -> void:
	_url = url
	_connected = false
	_last_heartbeat_ms = 0
	if _is_web():
		_browser_connect(url)
	else:
		if _ws.get_ready_state() != WebSocketPeer.STATE_CLOSED:
			_ws.close()
		_ws = WebSocketPeer.new()
		_ws.connect_to_url(_url)


func disconnect_from_server() -> void:
	if _is_web():
		_browser_close()
		return
	_ws.close()
	_connected = false


func poll() -> void:
	if _is_web():
		while _browser_queue.size() > 0:
			var text: String = _browser_queue[0]
			_browser_queue.remove_at(0)
			_dispatch_json_text(text)
		_maybe_heartbeat()
		return
	_ws.poll()
	var state := _ws.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		if not _connected:
			_connected = true
			connected.emit()
		_incoming_native()
		_maybe_heartbeat()
	elif state == WebSocketPeer.STATE_CLOSED:
		if _connected:
			_connected = false
			disconnected.emit()
		_connected = false


func _dispatch_json_text(text: String) -> void:
	if text.is_empty():
		return
	var msg: Variant = JSON.parse_string(text)
	if msg == null:
		push_error("Invalid JSON: %s" % text)
		return
	if typeof(msg) != TYPE_DICTIONARY:
		return
	message_received.emit(msg)


func _incoming_native() -> void:
	while _ws.get_available_packet_count() > 0:
		var buf: PackedByteArray = _ws.get_packet()
		_dispatch_json_text(buf.get_string_from_utf8())


func send_message(msg: Dictionary) -> void:
	var text := JSON.stringify(msg)
	if _is_web():
		if not _connected or _js_ws == null:
			push_error("Send while not open")
			return
		_js_ws.call("send", text)
		return
	if _ws.get_ready_state() != WebSocketPeer.STATE_OPEN:
		push_error("Send while not open")
		return
	_ws.send(text.to_utf8_buffer())


func is_connected_to_server() -> bool:
	if _is_web():
		return _connected
	return _ws.get_ready_state() == WebSocketPeer.STATE_OPEN


func is_connecting() -> bool:
	if _is_web():
		return _js_ws != null and not _connected
	var state := _ws.get_ready_state()
	return state == WebSocketPeer.STATE_CONNECTING or state == WebSocketPeer.STATE_CLOSING


func _maybe_heartbeat() -> void:
	if not is_connected_to_server():
		return
	var now := Time.get_ticks_msec()
	if _last_heartbeat_ms != 0 and now - _last_heartbeat_ms < HEARTBEAT_MS:
		return
	_last_heartbeat_ms = now
	send_message({ "type": "heartbeat" })


## Debug log visible on web — only populated when running as HTML5
var web_debug_log: String = ""

func _web_log(msg: String) -> void:
	print(msg)
	web_debug_log += msg + "\n"

func _browser_connect(url: String) -> void:
	_browser_close()
	_browser_queue.clear()
	_web_log("[ws] browser_connect: %s" % url)
	_js_open_cb = JavaScriptBridge.create_callback(_on_js_open)
	_js_msg_cb = JavaScriptBridge.create_callback(_on_js_msg)
	_js_close_cb = JavaScriptBridge.create_callback(_on_js_close)
	_js_err_cb = JavaScriptBridge.create_callback(_on_js_error)
	_js_ws = JavaScriptBridge.create_object("WebSocket", url)
	if _js_ws == null:
		_web_log("[ws] ERROR: create_object('WebSocket') returned null")
		return
	_web_log("[ws] WebSocket object created, setting handlers…")
	_js_ws.onopen = _js_open_cb
	_js_ws.onmessage = _js_msg_cb
	_js_ws.onclose = _js_close_cb
	_js_ws.onerror = _js_err_cb
	_web_log("[ws] handlers set, waiting for connection…")


func _browser_close() -> void:
	if _js_ws != null:
		_js_ws.call("close")
		_js_ws = null
	_connected = false


func _on_js_open(_args: Array) -> void:
	_web_log("[ws] onopen fired!")
	call_deferred("_emit_connected")


func _emit_connected() -> void:
	if _connected:
		return
	_connected = true
	connected.emit()


func _on_js_msg(args: Array) -> void:
	if args.size() < 1:
		return
	var event = args[0]
	var data = str(event.data)
	if data.is_empty():
		return
	call_deferred("_push_msg", data)


func _push_msg(text: String) -> void:
	_browser_queue.append(text)


func _on_js_close(_args: Array) -> void:
	var code: int = -1
	var reason: String = ""
	if _args.size() > 0:
		var ev = _args[0]
		code = int(ev.code) if ev != null else -1
		reason = str(ev.reason) if ev != null else ""
	_web_log("[ws] onclose code=%d reason='%s'" % [code, reason])
	call_deferred("_emit_disconnected")


func _on_js_error(_args: Array) -> void:
	_web_log("[ws] onerror fired")
	if _js_ws != null:
		_js_ws.call("close")


func _emit_disconnected() -> void:
	_js_ws = null
	if not _connected:
		return
	_connected = false
	disconnected.emit()


## --- Convenience senders (match server ClientMessage types) ---

func login(name: String) -> void:
	send_message({ "type": "login", "name": name })


func lobby_chat(text: String) -> void:
	send_message({ "type": "lobby_chat", "text": text })


func table_create(side: String) -> void:
	send_message({ "type": "table_create", "side": side })


func table_join(table_id: String, side: String) -> void:
	send_message({ "type": "table_join", "tableId": table_id, "side": side })


func table_leave() -> void:
	send_message({ "type": "table_leave" })


func table_ready(ready: bool) -> void:
	send_message({ "type": "table_ready", "ready": ready })


func table_deck_select(deck_id: String) -> void:
	send_message({ "type": "table_deck_select", "deckId": deck_id })


func table_deck_select_custom(cards: Array) -> void:
	send_message({ "type": "table_deck_select_custom", "name": "custom", "cards": cards })


func table_start() -> void:
	send_message({ "type": "table_start" })


func start_bot_game(player_side: String, player_deck_id: String, player_deck_custom: Array, bot_deck_id: String, bot_deck_custom: Array) -> void:
	var payload: Dictionary = { "type": "start_bot_game", "playerSide": player_side }
	if not player_deck_id.is_empty():
		payload["playerDeckId"] = player_deck_id
	if player_deck_custom.size() > 0:
		payload["playerDeckCustom"] = player_deck_custom
	if not bot_deck_id.is_empty():
		payload["botDeckId"] = bot_deck_id
	if bot_deck_custom.size() > 0:
		payload["botDeckCustom"] = bot_deck_custom
	send_message(payload)


func game_chat(text: String) -> void:
	send_message({ "type": "game_chat", "text": text })


func game_action(action: Dictionary) -> void:
	send_message({ "type": "game_action", "action": action })


func game_concede() -> void:
	send_message({ "type": "game_concede" })


func return_to_lobby(game_id_from_state: String = "") -> void:
	var payload: Dictionary = { "type": "return_to_lobby" }
	if not game_id_from_state.is_empty():
		payload["gameId"] = game_id_from_state
	send_message(payload)
