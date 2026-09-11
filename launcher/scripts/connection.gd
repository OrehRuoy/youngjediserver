## Autoload: shared network client and game state across Lobby and Waiting Room scenes.
extends Node

const NetworkClientScript = preload("res://scripts/network_client.gd")
const GameStateScript = preload("res://scripts/game_state.gd")

const SERVER_LOCAL := "ws://127.0.0.1:49152"
## After Render deploy, set to wss://YOUR-APP.onrender.com (see server/DEPLOY.md).
const SERVER_REMOTE := "wss://mnbsekfunp.localto.net"

var _client: RefCounted
var _state: RefCounted


func get_server_url() -> String:
	if OS.is_debug_build():
		return SERVER_LOCAL
	if ProjectSettings.get_setting("application/config/use_local_server", false):
		return SERVER_LOCAL
	return SERVER_REMOTE


func switch_to_remote_server() -> void:
	ProjectSettings.set_setting("application/config/use_local_server", false)


func get_client() -> RefCounted:
	if _client == null:
		_client = NetworkClientScript.new()
	return _client


func get_state() -> RefCounted:
	if _state == null:
		_state = GameStateScript.new()
	return _state
