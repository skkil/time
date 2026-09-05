import type { Rgb } from './colors';

export type FrameUniforms = {
  time: number;
  colors: Rgb[];
  ripple: [number, number, number];
};

export type Renderer = {
  render(uniforms: FrameUniforms): void;
  resize(width: number, height: number): void;
  dispose(): void;
};

const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

function warn(message: string, detail?: string | null) {
  if (import.meta.env.DEV) console.warn(`[zen] ${message}`, detail ?? '');
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  warn('shader compile failed', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function link(gl: WebGL2RenderingContext, fragmentSource: string) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = vertex && fragment ? gl.createProgram() : null;
  if (program && vertex && fragment) {
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
  }
  if (vertex) gl.deleteShader(vertex);
  if (fragment) gl.deleteShader(fragment);
  if (!program) return null;
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  warn('program link failed', gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  fragmentSource: string,
  { strict }: { strict: boolean },
): Renderer | null {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: strict,
    });
  } catch {
    gl = null;
  }
  if (!gl || gl.isContextLost()) return null;

  const program = link(gl, fragmentSource);
  const vao = program ? gl.createVertexArray() : null;
  if (!program || !vao) {
    if (program) gl.deleteProgram(program);
    return null;
  }

  const location = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = {
    resolution: location('u_resolution'),
    time: location('u_time'),
    colors: location('u_colors'),
    ripple: location('u_ripple'),
  };

  return {
    render({ time, colors, ripple }) {
      if (gl.isContextLost()) return;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(
        uniforms.resolution,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      );
      gl.uniform1f(uniforms.time, time);
      gl.uniform3fv(uniforms.colors, colors.flat());
      gl.uniform3fv(uniforms.ripple, ripple);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resize(width, height) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
    },
    dispose() {
      if (!gl.isContextLost()) {
        gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
