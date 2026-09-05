export const waterShader = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colors[4];
uniform vec3 u_ripple;

out vec4 fragColor;

const float TAU = 6.2831853;
const float SCALE = 2.4;
const float SWELL_PERIOD = 32.0;
const float SWELL_AMOUNT = 0.05;
const vec2 DRIFT = vec2(0.018, -0.011);
const float WARP = 0.85;
const float DEPTH_WOBBLE = 0.22;
const float CAUSTIC_STRENGTH = 0.07;
const float CAUSTIC_SHARPNESS = 5.0;
const float RIPPLE_STRENGTH = 0.018;
const float RIPPLE_DECAY = 0.7;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  float a = hash(cell);
  float b = hash(cell + vec2(1.0, 0.0));
  float c = hash(cell + vec2(0.0, 1.0));
  float d = hash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

float fbm(vec2 p) {
  mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);
  float sum = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    sum += amplitude * noise(p);
    p = turn * p * 2.07 + vec2(3.1, 7.7);
    amplitude *= 0.5;
  }
  return sum;
}

vec3 depthColor(float depth) {
  depth = clamp(depth, 0.0, 1.0);
  vec3 upper = mix(u_colors[0], u_colors[1], smoothstep(0.0, 0.38, depth));
  vec3 lower = mix(u_colors[2], u_colors[3], smoothstep(0.72, 1.0, depth));
  return mix(upper, lower, smoothstep(0.38, 0.72, depth));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * SCALE;
  float t = u_time;
  float phase = t * TAU / SWELL_PERIOD;

  p += SWELL_AMOUNT * vec2(sin(p.y * 1.3 + phase), cos(p.x * 0.9 - phase));

  vec2 toRipple = (uv - u_ripple.xy) * vec2(aspect, 1.0);
  float reach = length(toRipple);
  float age = max(t - u_ripple.z, 0.0);
  float ring = sin(reach * 38.0 - age * 4.0)
    * exp(-age * RIPPLE_DECAY)
    * exp(-reach * 5.0)
    * (1.0 - smoothstep(age * 0.16 - 0.05, age * 0.16 + 0.05, reach));
  p += RIPPLE_STRENGTH * ring * normalize(toRipple + 1e-4);

  vec2 drift = DRIFT * t;
  vec2 warp = vec2(
    fbm(p + drift),
    fbm(p * 1.1 - drift.yx + vec2(5.2, 1.3))
  );
  float field = fbm(p + WARP * warp + drift * 0.6);

  float depth = 1.0 - uv.y + (field - 0.5) * DEPTH_WOBBLE;
  vec3 color = depthColor(depth);

  vec2 causticP = p * 1.7 + warp * 1.4;
  float near = fbm(causticP + vec2(t * 0.021, t * 0.013));
  float far = fbm(causticP - vec2(t * 0.017, -t * 0.019) + 4.7);
  float band = pow(1.0 - clamp(abs(near - far) * 3.2, 0.0, 1.0), CAUSTIC_SHARPNESS);
  float shimmer = band * CAUSTIC_STRENGTH * (1.0 - 0.5 * clamp(depth, 0.0, 1.0));
  vec3 light = max(u_colors[0], u_colors[1]);
  color = mix(color, light, shimmer);

  color += (hash(gl_FragCoord.xy + fract(t * 7.0) * 61.0) - 0.5) / 255.0;
  fragColor = vec4(color, 1.0);
}
`;
