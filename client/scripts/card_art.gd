## The only card-picture loader. Deck builder, the table, and duels all use this.
## Do not add another copy, and do not use ResourceLoader.exists to decide if the picture is there.
## Imported pictures in the game pack often fail that check and then the screen shows the card name instead.
extends RefCounted

static var _missing: Dictionary = {}


static func load_texture(card_id: String, side_hint: String = "", set_hint: String = "") -> Texture2D:
	if card_id.is_empty() or CardCatalog == null or not CardCatalog.has_method("get_card_image_paths"):
		return null
	var paths: Array[String] = CardCatalog.get_card_image_paths(card_id, side_hint, set_hint)
	if not set_hint.is_empty():
		for path in CardCatalog.get_card_image_paths(card_id, side_hint, ""):
			if not paths.has(path):
				paths.append(path)
	for path in paths:
		var tex := load(path) as Texture2D
		if tex == null:
			continue
		if CardCatalog.has_method("smooth_texture"):
			tex = CardCatalog.smooth_texture(tex)
		return tex
	if not _missing.has(card_id):
		_missing[card_id] = true
		push_warning("Card image missing for '%s'. The name is showing because the picture file was not found." % card_id)
	return null
