## WebSocket client for Young Jedi TCG server.
## Handles connect/disconnect, JSON send/recv, and dispatches messages by type.
class_name NetworkClient
extends RefCounted

signal connected()
signal disconnected()
signal message_received(msg: Dictionary)

const DEFAULT_URL := "wss://youngjediserver.onrender.com"
const HEARTBEAT_MS := 25000

var _ws: WebSocketPeer
var _url: String = DEFAULT_URL
var _connected: bool = false
var _last_heartbeat_ms: int = 0

func _init() -> void:
	_ws = WebSocketPeer.new()


func connect_to_server(url: String = DEFAULT_URL) -> void:
	_url = url
	_connected = false
	_last_heartbeat_ms = 0
	if _ws.get_ready_state() != WebSocketPeer.STATE_CLOSED:
		_ws.close()
	_ws = WebSocketPeer.new()
	_ws.connect_to_url(_url)


func disconnect_from_server() -> void:
	_ws.close()
	_connected = false


func poll() -> void:
	_ws.poll()
	var state := _ws.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		if not _connected:
			_connected = true
			connected.emit()
		_incoming()
		_maybe_heartbeat()
	elif state == WebSocketPeer.STATE_CLOSED:
		if _connected:
			_connected = false
			disconnected.emit()
		_connected = false


func _incoming() -> void:
	while _ws.get_available_packet_count() > 0:
		var buf: PackedByteArray = _ws.get_packet()
		var text := buf.get_string_from_utf8()
		if text.is_empty():
			continue
		var msg: Variant = JSON.parse_string(text)
		if msg == null:
			push_error("Invalid JSON: %s" % text)
			continue
		if typeof(msg) != TYPE_DICTIONARY:
			continue
		message_received.emit(msg)


func send_message(msg: Dictionary) -> void:
	if _ws.get_ready_state() != WebSocketPeer.STATE_OPEN:
		push_error("Send while not open")
		return
	var text := JSON.stringify(msg)
	_ws.send(text.to_utf8_buffer())


func is_connected_to_server() -> bool:
	return _ws.get_ready_state() == WebSocketPeer.STATE_OPEN


func is_connecting() -> bool:
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
