## Loads card index (id -> name, side, image) for display. Autoload: CardCatalog.
## Reads data/cards/index.json (sets list) and each data/cards/<set>.json, matching server layout.
## When run from launcher, call _load_index() after load_resource_pack() so cards load from the pack.
extends Node

var _by_id: Dictionary = {}
var _by_id_first: Dictionary = {}

func _ready() -> void:
	_load_index()

func _load_index() -> void:
	_by_id.clear()
	_by_id_first.clear()
	var index_path := "res://data/cards/index.json"
	if not FileAccess.file_exists(index_path):
		push_warning("CardCatalog: No data/cards/index.json at %s" % index_path)
		return
	var index_file := FileAccess.open(index_path, FileAccess.READ)
	if not index_file:
		push_warning("CardCatalog: Could not open %s" % index_path)
		return
	var index_data = JSON.parse_string(index_file.get_as_text())
	index_file.close()
	if index_data == null:
		push_warning("CardCatalog: Invalid JSON in data/cards/index.json")
		return
	if not (index_data is Dictionary and index_data.has("sets") and index_data.sets is Array):
		push_warning("CardCatalog: index.json has no 'sets' array")
		return
	for set_id in index_data.sets:
		var set_path := "res://data/cards/%s.json" % set_id
		if not FileAccess.file_exists(set_path):
			push_warning("CardCatalog: Set file not found: %s" % set_path)
			continue
		var set_file := FileAccess.open(set_path, FileAccess.READ)
		if not set_file:
			push_warning("CardCatalog: Could not open %s" % set_path)
			continue
		var set_data = JSON.parse_string(set_file.get_as_text())
		set_file.close()
		if set_data == null:
			push_warning("CardCatalog: Invalid JSON in %s" % set_path)
			continue
		if set_data is Dictionary and set_data.has("cards") and set_data.cards is Array:
			for card in set_data.cards:
				if card is Dictionary and card.get("id", ""):
					var info: Dictionary = {}
					for key in card.keys():
						info[key] = card[key]
					var sid: String = card.get("set", set_id)
					var key_with_set: String = card.get("id", "") + ":" + sid
					_by_id[key_with_set] = info
					if not _by_id_first.has(card.get("id", "")):
						_by_id_first[card.get("id", "")] = info

## Returns all card info dictionaries (one per card per set, so duplicate titles from different sets appear separately).
func get_all_cards() -> Array:
	return _by_id.values()

## Returns { name, side, image, type, set } or empty Dictionary if not found.
## set_hint: if provided, looks up the card from that set (for locations etc. with same id in multiple sets).
## If not found and side_hint is set, tries card_id + "_" + side_hint (e.g. "blaster" + "_light").
func get_card_info(card_id: String, side_hint: String = "", set_hint: String = "") -> Dictionary:
	if set_hint:
		var info: Dictionary = _by_id.get(card_id + ":" + set_hint, {})
		if not info.is_empty():
			return info
	var info: Dictionary = _by_id_first.get(card_id, {})
	if info.is_empty() and side_hint and (card_id == "blaster" or card_id == "blasterrifle"):
		info = _by_id_first.get(card_id + "_" + side_hint, {})
	return info


## Returns an array of resource paths to try for loading this card's image.
func get_card_image_paths(card_id: String, side_hint: String = "") -> Array[String]:
	var info: Dictionary = get_card_info(card_id, side_hint)
	var set_name: String = info.get("set", "menaceofdarthmaul")
	var side: String = info.get("side", "")
	var image_file: String = info.get("image", "")
	if side.is_empty() or image_file.is_empty():
		return []
	var bases: Array[String] = [
		"res://assets/%s/%s/%s" % [set_name, side, image_file],
		"res://client/assets/%s/%s/%s" % [set_name, side, image_file]
	]
	var paths: Array[String] = []
	for base in bases:
		paths.append(base)
		if image_file.to_lower().ends_with(".gif"):
			paths.append(base.replace(".gif", ".png").replace(".GIF", ".png"))
	return paths
