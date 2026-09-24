## The only card-picture loader. Deck builder, the table, and duels all use this.
## Do not add another copy. Do not use ResourceLoader.exists or FileAccess.file_exists
## to decide if a picture is there. Packed pictures fail that check and the screen
## then shows the card name.
extends RefCounted

static var _missing: Dictionary = {}
static var _reloaded_catalog: bool = false


static func load_texture(card_id: String, side_hint: String = "", set_hint: String = "") -> Texture2D:
	if card_id.is_empty() or CardCatalog == null or not CardCatalog.has_method("get_card_info"):
		return null
	var tex := _load_from_info(card_id, side_hint, set_hint)
	if tex == null and not _reloaded_catalog and CardCatalog.has_method("_load_index"):
		_reloaded_catalog = true
		CardCatalog._load_index()
		tex = _load_from_info(card_id, side_hint, set_hint)
	if tex == null and not _missing.has(card_id):
		_missing[card_id] = true
		push_warning("Card image missing for '%s'. The name is showing because the picture file was not found." % card_id)
	return tex


static func _load_from_info(card_id: String, side_hint: String, set_hint: String) -> Texture2D:
	var info: Dictionary = CardCatalog.get_card_info(card_id, side_hint, set_hint)
	var tex := _load_info(info)
	if tex == null and not set_hint.is_empty():
		tex = _load_info(CardCatalog.get_card_info(card_id, side_hint, ""))
	return tex


static func _load_info(info: Dictionary) -> Texture2D:
	var set_name := str(info.get("set", ""))
	var side := str(info.get("side", ""))
	var image_file := str(info.get("image", ""))
	if set_name.is_empty() or side.is_empty() or image_file.is_empty():
		return null
	var path := "res://assets/%s/%s/%s" % [set_name, side, image_file]
	var tex := load(path) as Texture2D
	if tex == null and image_file.to_lower().ends_with(".gif"):
		tex = load(path.replace(".gif", ".png").replace(".GIF", ".png")) as Texture2D
	if tex != null and CardCatalog.has_method("smooth_texture"):
		var sharp: Texture2D = CardCatalog.smooth_texture(tex)
		if sharp != null:
			tex = sharp
	return tex
