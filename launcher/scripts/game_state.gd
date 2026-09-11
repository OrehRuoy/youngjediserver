## Client-side view of lobby, table, and game state.
## Updated from server messages; used by UI only (no game logic).
class_name GameState
extends RefCounted

signal lobby_updated()
signal table_updated(table: Dictionary)
signal game_started(payload: Dictionary)
signal game_state_updated(payload: Dictionary)
signal game_ended(payload: Dictionary)
signal game_hand(card_ids: Array)
signal chat_received(from: String, text: String, at: int)
signal error_received(msg: String)

# After login
var player_id: String = ""
var player_name: String = ""
var logged_in: bool = false

# Lobby
var players: Array[Dictionary] = []
var tables: Array[Dictionary] = []
var news_text: String = ""

# Current table (when in a table)
var current_table_id: String = ""
var current_table: Dictionary = {}
var my_side: String = ""  # "light" or "dark"

# In-game (when game has started)
var in_game: bool = false
var game_id: String = ""
var game_side: String = ""
var game_state: Dictionary = {}
var hand_card_ids: Array = []
var hand_with_instances: Array = []  # [ { instanceId, cardId }, ... ] for play_card


func apply_message(msg: Dictionary) -> void:
	var t: String = msg.get("type", "")
	match t:
		"login_result":
			logged_in = msg.get("ok", false)
			if logged_in:
				player_id = msg.get("playerId", "")
				player_name = msg.get("name", "")
		"lobby_snapshot":
			players.clear()
			for p in msg.get("players", []):
				players.append(p)
			tables.clear()
			for tb in msg.get("tables", []):
				tables.append(tb)
			news_text = msg.get("news", "")
			# If we're no longer in any table (e.g. host disbanded it), clear table state so UI goes to lobby.
			var in_table := false
			for p in players:
				if p.get("id", "") == player_id:
					var ptid: String = p.get("tableId", "")
					if ptid.is_empty():
						break
					for tb in tables:
						if tb.get("id", "") == ptid:
							in_table = true
							break
					break
			if not in_table:
				leave_table_state()
			lobby_updated.emit()
		"lobby_chat":
			chat_received.emit(msg.get("from", ""), msg.get("text", ""), msg.get("at", 0))
		"table_update":
			current_table = msg.get("table", {})
			current_table_id = current_table.get("id", "")
			# Keep tables list in sync: update or add this table so lobby list shows it
			var tid: String = current_table.get("id", "")
			if not tid.is_empty():
				var found: int = -1
				for i in tables.size():
					if tables[i].get("id", "") == tid:
						found = i
						break
				if found >= 0:
					tables[found] = current_table
				else:
					tables.append(current_table)
			table_updated.emit(current_table)
		"game_started":
			in_game = true
			game_id = msg.get("gameId", "")
			game_side = msg.get("side", "")
			game_state = msg.get("state", {})
			game_started.emit(msg)
		"game_state":
			game_state = msg.get("state", {})
			game_state_updated.emit(msg)
		"game_hand":
			# hand is [ { instanceId, cardId }, ... ] for play_card
			var h = msg.get("hand", [])
			if h.is_empty():
				h = msg.get("cardIds", [])  # legacy: list of cardIds
				hand_card_ids = h
				hand_with_instances.clear()
			else:
				hand_with_instances.clear()
				for entry in h:
					hand_with_instances.append(entry)
				hand_card_ids = []
				for e in hand_with_instances:
					hand_card_ids.append(e.get("cardId", ""))
			game_hand.emit(hand_card_ids)
		"game_chat":
			chat_received.emit(msg.get("from", ""), msg.get("text", ""), msg.get("at", 0))
		"game_ended":
			in_game = false
			game_ended.emit(msg)
		"error":
			error_received.emit(msg.get("error", "Unknown error"))


func leave_table_state() -> void:
	current_table_id = ""
	current_table = {}
	my_side = ""


func leave_game_state() -> void:
	in_game = false
	game_id = ""
	game_side = ""
	game_state = {}
	hand_card_ids = []
