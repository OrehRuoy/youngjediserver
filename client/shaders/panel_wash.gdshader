shader_type canvas_item;

// A quiet light from the top of a panel, like frosted glass. No stripes.
uniform vec4 tint : source_color = vec4(0.72, 0.84, 1.0, 1.0);
uniform float top_strength : hint_range(0.0, 0.4) = 0.16;

void fragment() {
	float from_top = pow(clamp(1.0 - UV.y, 0.0, 1.0), 1.7);
	float center = 1.0 - smoothstep(0.15, 0.95, length((UV - vec2(0.5, 0.35)) * vec2(1.1, 1.0)));
	float alpha = from_top * top_strength + center * top_strength * 0.22;
	COLOR = vec4(tint.rgb, alpha);
}
