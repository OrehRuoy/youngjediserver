## Cover / card-face textures for waiting rooms.
## Does not rely on CardCatalog.load_card_texture — the launcher autoload may not have it.
class_name CoverArt
extends Object


static func load_texture(card_id: String, side_hint: String = "", set_hint: String = "") -> Texture2D:
	if card_id.is_empty():
		return null
	if CardCatalog and CardCatalog.has_method("load_card_texture"):
		var via_catalog: Texture2D = CardCatalog.load_card_texture(card_id, side_hint, set_hint)
		if via_catalog:
			return via_catalog
	if CardCatalog == null or not CardCatalog.has_method("get_card_info"):
		return null
	var info: Dictionary = CardCatalog.get_card_info(card_id, side_hint, set_hint)
	if info.is_empty():
		return null
	var set_name: String = str(info.get("set", "menaceofdarthmaul"))
	var side: String = str(info.get("side", side_hint))
	var image_file: String = str(info.get("image", ""))
	if side.is_empty() or image_file.is_empty():
		return null
	var paths: Array[String] = [
		"res://assets/%s/%s/%s" % [set_name, side, image_file],
	]
	if image_file.to_lower().ends_with(".gif"):
		paths.append("res://assets/%s/%s/%s" % [set_name, side, image_file.get_basename() + ".png"])
	for p in paths:
		var tex: Texture2D = load(p) as Texture2D
		if tex:
			return tex
	return null
