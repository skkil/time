import { rgb, skyAt } from '@skkil-time/design/sky';

import {
  moonDirection,
  nightAmount,
  sunDirection,
  sunlight,
  twilight,
  wrapHour,
} from './bodies';
import { ATMOSPHERE, COMPOSITE, VERTEX } from './shaders';

export type Sky = { setHour(hour: number): void };

const LOOKUP_WIDTH = 192;
const RENDER_SCALE = 0.6;
const FRAME_MS = 1000 / 30;
const PITCH = (16 * Math.PI) / 180;

function compile(gl: WebGL2RenderingContext, fragment: string) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'position');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? 'program');
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const at = (name: string) => {
    if (!uniforms.has(name))
      uniforms.set(name, gl.getUniformLocation(program, name));
    return uniforms.get(name)!;
  };
  return { program, at };
}

/** A painted CSS sky from the app's own colour stops, for browsers without WebGL 2. */
function paintFallback(canvas: HTMLCanvasElement): Sky {
  const host = canvas.parentElement!;
  canvas.remove();
  return {
    setHour(hour) {
      const sky = skyAt(hour);
      host.style.filter = `saturate(${1 - 0.85 * twilight(sunDirection(hour))})`;
      host.style.background = `radial-gradient(120% 80% at 30% 10%, ${rgb(sky.glows[0], 0.6)}, transparent 60%), linear-gradient(180deg, ${rgb(sky.top)}, ${rgb(sky.bottom)})`;
    },
  };
}

export function createSky(canvas: HTMLCanvasElement, still: boolean): Sky {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    depth: false,
    powerPreference: 'low-power',
  });
  if (!gl) return paintFallback(canvas);

  let atmosphere;
  let composite;
  try {
    atmosphere = compile(gl, ATMOSPHERE);
    composite = compile(gl, COMPOSITE);
  } catch {
    return paintFallback(canvas);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const lookup = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, lookup);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const target = gl.createFramebuffer();

  let hour = 12;
  let lookupHeight = 0;
  let lookupFor = '';
  let last = 0;
  const started = performance.now();

  const view = () => {
    const aspect = canvas.width / canvas.height;
    const tanHalf = Math.tan(((aspect >= 1 ? 30 : 40) * Math.PI) / 180);
    return { aspect, tanHalf };
  };

  const setView = (at: (name: string) => WebGLUniformLocation | null) => {
    const { aspect, tanHalf } = view();
    gl.uniform1f(at('uAspect'), aspect);
    gl.uniform1f(at('uTanHalf'), tanHalf);
    gl.uniform1f(at('uPitch'), PITCH);
  };

  const resize = () => {
    const width = Math.round(
      canvas.clientWidth * RENDER_SCALE * Math.min(devicePixelRatio, 2),
    );
    const height = Math.round(
      canvas.clientHeight * RENDER_SCALE * Math.min(devicePixelRatio, 2),
    );
    if (width === canvas.width && height === canvas.height) return;
    canvas.width = width;
    canvas.height = height;
    lookupHeight = Math.max(32, Math.round((LOOKUP_WIDTH * height) / width));
    gl.bindTexture(gl.TEXTURE_2D, lookup);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      LOOKUP_WIDTH,
      lookupHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      lookup,
      0,
    );
    lookupFor = '';
  };

  const draw = (now: number) => {
    resize();
    const sun = sunDirection(hour);
    const moon = moonDirection(hour);
    const night = nightAmount(sun);
    const moonLight = night * Math.min(Math.max(moon[1] * 6 + 0.2, 0), 1);
    const key = `${hour.toFixed(3)}:${canvas.width}x${canvas.height}`;

    if (key !== lookupFor) {
      lookupFor = key;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.viewport(0, 0, LOOKUP_WIDTH, lookupHeight);
      gl.useProgram(atmosphere.program);
      setView(atmosphere.at);
      gl.uniform3fv(atmosphere.at('uSun'), sun);
      gl.uniform3fv(atmosphere.at('uMoon'), moon);
      gl.uniform1f(atmosphere.at('uNight'), night);
      gl.uniform1f(atmosphere.at('uMoonLight'), moonLight);
      gl.uniform1f(atmosphere.at('uExposure'), 1.1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(composite.program);
    setView(composite.at);
    const { tanHalf } = view();
    gl.uniform1f(
      composite.at('uHorizon'),
      (-Math.tan(PITCH) / tanHalf + 1) / 2,
    );
    gl.uniform3fv(composite.at('uSun'), sun);
    gl.uniform3fv(composite.at('uMoon'), moon);
    gl.uniform3fv(composite.at('uSunlight'), sunlight(sun));
    gl.uniform1f(composite.at('uNight'), night);
    gl.uniform1f(composite.at('uCool'), twilight(sun));
    gl.uniform1f(composite.at('uMoonLight'), moonLight);
    gl.uniform1f(
      composite.at('uTime'),
      still ? 40 : (now - started) / 1000 + 40,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lookup);
    gl.uniform1i(composite.at('uSky'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let queued = false;
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame((now) => {
      queued = false;
      if (document.hidden) return;
      if (now - last >= FRAME_MS || still) {
        last = now;
        draw(now);
      }
      if (!still) request();
    });
  };

  document.addEventListener('visibilitychange', request);
  window.addEventListener('resize', request);
  request();

  return {
    setHour(next) {
      hour = wrapHour(next);
      if (still) request();
    },
  };
}
