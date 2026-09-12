## In-game bug report form. Submits to Web3Forms (same inbox as the access key).
extends Control

const SUBMIT_URL := "https://api.web3forms.com/submit"
const ACCESS_KEY := "1ce4db7a-c452-4c45-a62a-607849b4ecb8"

@onready var name_edit: LineEdit = %NameEdit
@onready var email_edit: LineEdit = %EmailEdit
@onready var os_edit: LineEdit = %OsEdit
@onready var message_edit: TextEdit = %MessageEdit
@onready var status_label: Label = %StatusLabel
@onready var submit_btn: Button = %SubmitBtn
@onready var cancel_btn: Button = %CancelBtn
@onready var dimmer: ColorRect = %Dimmer

var _http: HTTPRequest


func _ready() -> void:
	os_edit.text = _detect_os()
	submit_btn.pressed.connect(_on_submit_pressed)
	cancel_btn.pressed.connect(_close)
	dimmer.gui_input.connect(_on_dimmer_input)
	_http = HTTPRequest.new()
	_http.timeout = 20.0
	add_child(_http)
	_http.request_completed.connect(_on_request_completed)


func prefill(player_name: String) -> void:
	if name_edit and not player_name.is_empty():
		name_edit.text = player_name
		if email_edit:
			email_edit.grab_focus()
	elif name_edit:
		name_edit.grab_focus()


func _detect_os() -> String:
	var os_name := OS.get_name()
	var ver := OS.get_version()
	if ver.is_empty():
		return os_name
	return "%s %s" % [os_name, ver]


func _on_dimmer_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_close()


func _close() -> void:
	queue_free()


func _on_submit_pressed() -> void:
	var reporter := name_edit.text.strip_edges()
	var email := email_edit.text.strip_edges()
	var os_text := os_edit.text.strip_edges()
	var message := message_edit.text.strip_edges()
	if reporter.is_empty():
		_set_status("Please enter your name.", true)
		return
	if message.is_empty():
		_set_status("Please describe the bug.", true)
		return
	if not email.is_empty() and not email.contains("@"):
		_set_status("Email looks incomplete. Leave it blank if you don't want a reply.", true)
		return

	var payload: Dictionary = {
		"access_key": ACCESS_KEY,
		"subject": "Young Jedi Server bug report",
		"from_name": "Young Jedi",
		"name": reporter,
		"operating_system": os_text if not os_text.is_empty() else _detect_os(),
		"message": message,
	}
	if not email.is_empty():
		payload["email"] = email
		payload["replyto"] = email

	submit_btn.disabled = true
	cancel_btn.disabled = true
	_set_status("Sending…", false)
	var body := JSON.stringify(payload)
	var headers := PackedStringArray([
		"Content-Type: application/json",
		"Accept: application/json",
	])
	var err := _http.request(SUBMIT_URL, headers, HTTPClient.METHOD_POST, body)
	if err != OK:
		submit_btn.disabled = false
		cancel_btn.disabled = false
		_set_status("Could not send (error %d). Check your internet and try again." % err, true)


func _on_request_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	submit_btn.disabled = false
	cancel_btn.disabled = false
	var text := body.get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(text)
	var ok := response_code >= 200 and response_code < 300
	if parsed is Dictionary:
		ok = ok and bool(parsed.get("success", false))
		if not ok:
			var api_msg := str(parsed.get("message", "Send failed."))
			_set_status(api_msg, true)
			return
	if not ok:
		_set_status("Send failed (HTTP %d). Try again in a moment." % response_code, true)
		return
	_set_status("Thanks — your report was sent.", false)
	submit_btn.disabled = true
	await get_tree().create_timer(1.2).timeout
	_close()


func _set_status(text: String, is_error: bool) -> void:
	if status_label == null:
		return
	status_label.text = text
	status_label.add_theme_color_override("font_color", Color(0.95, 0.45, 0.4, 1) if is_error else Color(0.55, 0.85, 0.6, 1))
