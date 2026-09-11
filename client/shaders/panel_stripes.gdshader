shader_type canvas_item;

uniform float stripe_angle = 1.0;
uniform float stripe_scale : hint_range(8.0, 80.0) = 24.0;
uniform float stripe_opacity : hint_range(0.02, 0.2) = 0.07;
uniform float scanline_scale : hint_range(50.0, 200.0) = 120.0;
uniform float scanline_opacity : hint_range(0.0, 0.15) = 0.04;

void fragment() {
	vec2 uv = UV;
	float diag = uv.x + uv.y * stripe_angle;
	float stripe = mod(diag * stripe_scale, 1.0);
	float line = step(0.5, stripe);
	float alpha = line * stripe_opacity;

	float scan = mod(uv.y * scanline_scale, 1.0);
	float scanline = step(0.92, scan);
	alpha += scanline * scanline_opacity;

	COLOR = vec4(1.0, 1.0, 1.0, alpha);
}
