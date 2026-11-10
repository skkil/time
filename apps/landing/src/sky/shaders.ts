export const VERTEX = /* glsl */ `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const VIEW = /* glsl */ `
uniform float uAspect;
uniform float uTanHalf;
uniform float uPitch;

vec3 viewDir(vec2 uv) {
  vec2 p = (uv * 2.0 - 1.0) * vec2(uAspect * uTanHalf, uTanHalf);
  vec3 d = normalize(vec3(p, -1.0));
  float c = cos(uPitch);
  float s = sin(uPitch);
  return normalize(vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c));
}
`;

export const ATMOSPHERE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform float uNight;
uniform float uMoonLight;
uniform float uExposure;
${VIEW}

#define PI 3.14159265
#define PRIMARY_STEPS 16
#define LIGHT_STEPS 8

vec2 sphere(vec3 origin, vec3 dir, float radius) {
  float b = 2.0 * dot(dir, origin);
  float c = dot(origin, origin) - radius * radius;
  float d = b * b - 4.0 * c;
  if (d < 0.0) return vec2(1e5, -1e5);
  return vec2(-b - sqrt(d), -b + sqrt(d)) * 0.5;
}

vec3 scatter(vec3 dir, vec3 origin, vec3 sun) {
  const float planet = 6371e3;
  const float air = 6471e3;
  const vec3 rayleigh = vec3(5.5e-6, 13.0e-6, 22.4e-6);
  const float mie = 21e-6;
  const float rayleighHeight = 8e3;
  const float mieHeight = 1.2e3;
  const float g = 0.758;

  vec2 hit = sphere(origin, dir, air);
  if (hit.x > hit.y) return vec3(0.0);
  hit.y = min(hit.y, sphere(origin, dir, planet).x);
  float step = (hit.y - hit.x) / float(PRIMARY_STEPS);
  float travelled = 0.0;
  vec3 totalRayleigh = vec3(0.0);
  vec3 totalMie = vec3(0.0);
  float depthRayleigh = 0.0;
  float depthMie = 0.0;

  float mu = dot(dir, sun);
  float gg = g * g;
  float phaseRayleigh = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  float phaseMie = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mu * mu + 1.0)) /
    (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));

  for (int i = 0; i < PRIMARY_STEPS; i++) {
    vec3 point = origin + dir * (travelled + step * 0.5);
    float height = length(point) - planet;
    float stepRayleigh = exp(-height / rayleighHeight) * step;
    float stepMie = exp(-height / mieHeight) * step;
    depthRayleigh += stepRayleigh;
    depthMie += stepMie;

    float lightStep = sphere(point, sun, air).y / float(LIGHT_STEPS);
    float lightTravelled = 0.0;
    float lightRayleigh = 0.0;
    float lightMie = 0.0;
    for (int j = 0; j < LIGHT_STEPS; j++) {
      vec3 lightPoint = point + sun * (lightTravelled + lightStep * 0.5);
      float lightHeight = length(lightPoint) - planet;
      lightRayleigh += exp(-lightHeight / rayleighHeight) * lightStep;
      lightMie += exp(-lightHeight / mieHeight) * lightStep;
      lightTravelled += lightStep;
    }
    vec3 attenuation = exp(-(mie * (depthMie + lightMie) +
      rayleigh * (depthRayleigh + lightRayleigh)));
    totalRayleigh += stepRayleigh * attenuation;
    totalMie += stepMie * attenuation;
    travelled += step;
  }
  return 22.0 * (phaseRayleigh * rayleigh * totalRayleigh + phaseMie * mie * totalMie);
}

void main() {
  vec3 dir = viewDir(vUv);
  vec3 up = normalize(vec3(dir.x, max(dir.y, 0.002), dir.z));
  vec3 sky = 1.0 - exp(-uExposure * scatter(up, vec3(0.0, 6372e3, 0.0), uSun));

  float height = sqrt(clamp(dir.y, 0.0, 1.0));
  vec3 night = mix(vec3(0.05, 0.07, 0.13), vec3(0.012, 0.02, 0.05), height);
  float moonAngle = acos(clamp(dot(dir, uMoon), -1.0, 1.0));
  night += vec3(0.07, 0.085, 0.12) * exp(-moonAngle * 2.6) * uMoonLight;
  color = vec4(sky + night * uNight, 1.0);
}`;

export const COMPOSITE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
uniform sampler2D uSky;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform vec3 uSunlight;
uniform float uNight;
uniform float uMoonLight;
uniform float uTime;
uniform float uHorizon;
${VIEW}

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    value += amplitude * noise(p);
    p = turn * p;
    amplitude *= 0.5;
  }
  return value;
}

float clouds(vec2 p) {
  return fbm(p * 1.3 + fbm(p * 0.55 + 3.1) * 0.7);
}

vec3 tone(vec3 c) { return 1.0 - exp(-c); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec3 dir = viewDir(vUv);
  vec3 sky = texture(uSky, vUv).rgb;
  vec3 col = sky;
  float elevation = asin(clamp(dir.y, -1.0, 1.0));
  float azimuth = atan(dir.x, -dir.z);
  float dark = 1.0 - smoothstep(0.06, 0.3, luma(sky));

  if (dir.y > 0.0 && uNight > 0.0) {
    vec2 grid = vec2(azimuth, elevation) * 95.0;
    vec2 cell = floor(grid);
    float seed = hash(cell);
    if (seed > 0.982) {
      vec2 offset = vec2(hash(cell + 7.1), hash(cell + 3.7)) - 0.5;
      float d = length(fract(grid) - 0.5 - offset * 0.6);
      float bright = pow((seed - 0.982) / 0.018, 3.0);
      float twinkle = 0.75 + 0.25 * sin(uTime * (0.8 + seed * 3.0) + seed * 50.0);
      col += vec3(0.88, 0.93, 1.0) * smoothstep(0.22, 0.0, d) * (0.35 + 1.2 * bright) *
        twinkle * uNight * dark * smoothstep(0.0, 0.12, dir.y);
    }
  }

  float moonAngle = acos(clamp(dot(dir, uMoon), -1.0, 1.0));
  if (uMoonLight > 0.0) {
    float radius = 0.013;
    float disk = smoothstep(radius, radius * 0.86, moonAngle);
    float maria = fbm((dir.xy - uMoon.xy) * 260.0 + 11.0);
    vec3 moon = vec3(0.96, 0.94, 0.89) * (0.72 + 0.3 * maria);
    col = mix(col, moon, disk * uMoonLight);
    col += vec3(0.55, 0.65, 0.85) * exp(-moonAngle * 22.0) * 0.16 * uMoonLight;
  }

  float sunAngle = acos(clamp(dot(dir, uSun), -1.0, 1.0));
  col += tone(uSunlight * 30.0) * smoothstep(0.0085, 0.0065, sunAngle);

  if (dir.y > 0.0) {
    vec2 wind = vec2(uTime * 0.006, uTime * 0.0022);
    vec2 p = dir.xz / (dir.y + 0.08) * 0.9 + wind;
    vec2 towardSun = normalize(uSun.xz + 1e-4) * 0.07;
    float density = clouds(p);
    float shadowed = clouds(p + towardSun);
    float cover = smoothstep(0.5, 0.78, density);
    float lit = 0.35 + 1.5 * clamp((density - shadowed) * 5.0 + 0.35, 0.0, 1.0);
    float forward = pow(max(dot(dir, uSun), 0.0), 5.0);
    vec3 sunLit = uSunlight * 5.5 * lit * (1.0 + 2.5 * forward);
    vec3 ambient = mix(sky, vec3(luma(sky)), 0.25) * 0.7;
    vec3 moonLit = vec3(0.1, 0.12, 0.17) * lit * uMoonLight;
    vec3 cloud = clamp(tone(sunLit) * 0.85 + ambient + moonLit, 0.0, 1.0);
    float distance = smoothstep(0.0, 0.2, dir.y);
    col = mix(col, cloud, cover * distance * 0.9);
  }

  vec3 haze = texture(uSky, vec2(vUv.x, uHorizon + 0.012)).rgb;
  float pixel = fwidth(elevation) * 1.2;
  float far = 0.004 + 0.05 * fbm(vec2(azimuth * 2.4, 1.3)) - 0.012;
  float near = -0.012 + 0.065 * fbm(vec2(azimuth * 3.6 + 10.0, 4.1)) - 0.02;
  vec3 farColor = mix(haze, haze * 0.5 + vec3(0.004, 0.006, 0.012), 0.55);
  vec3 nearColor = haze * 0.22 + vec3(0.006, 0.008, 0.016);
  col = mix(col, farColor, smoothstep(far + pixel, far - pixel, elevation));
  col = mix(col, nearColor, smoothstep(near + pixel, near - pixel, elevation));

  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  color = vec4(col, 1.0);
}`;
