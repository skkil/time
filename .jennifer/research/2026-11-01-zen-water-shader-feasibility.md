# Zen mode water backdrop: feasibility

2026-11-01. Scope: a full-screen animated WebGL water backdrop ("zen mode") in `apps/desktop`. No code changed.

## Verdict

Feasible. Build it as a raw WebGL2 fragment shader on one full-screen triangle, with no new dependency. The main risk is Linux. WebKitGTK can hand out a WebGL2 context that runs on a slow path and gives no error. Ship a CSS static/gradient fallback first, plus a user setting that forces it.

## 1. What exists today

- **Deps** (`package.json`): there is no three.js, OGL, regl or any other WebGL library. The stack is React 19 with React Compiler (`@rolldown/plugin-babel` plus `reactCompilerPreset`), Vite 8, Tailwind v4 and `tw-animate-css`.
- **Window** (`src-tauri/tauri.conf.json`): one window, 1200×820, minimum 900×600. Not transparent, not fullscreen. `csp: null`, so inline shader strings have no CSP issue. `bundle.targets: "all"`, so Linux, macOS and Windows are all targets.
- **Cargo.toml**: plain `tauri = "2"` with no extra features. A backdrop needs no Rust change.
- **Theme**: CSS variables live in `src/styles/globals.css`, such as `--background: #f5f5f2` (light) and `#17191e` under `.dark`, and `--primary`. Dark mode follows the OS through `src/hooks/use-color-scheme.ts`, which toggles `.dark`.
- **Motion**: `globals.css` already has a global `prefers-reduced-motion: reduce` rule that kills CSS animations. JS-driven rAF loops are **not** covered by it, so the shader has to check on its own.
- **Prefs**: `src/lib/preferences.ts` is a typed localStorage store (currently only `zoom`). It's the right place for `zenBackdrop: 'auto' | 'shader' | 'static' | 'off'`.
- **Local machine**: WebKitGTK 2.54.2 (`pkg-config`), Wayland, Intel Raptor Lake iGPU (Mesa 26.2.5, accelerated) plus an NVIDIA RTX 1000 Ada dGPU. Hybrid NVIDIA on Wayland is exactly the setup the Tauri docs flag.

## 2. Platform support

| Webview | WebGL2 | Notes |
|---|---|---|
| WebView2 (Windows) | Chromium-based; WebGL2 since Chrome 56 / Edge 79 ([caniuse](https://caniuse.com/webgl2)) | Low risk. |
| WKWebView (macOS) | Safari 15+ ([caniuse](https://caniuse.com/webgl2)) | Low risk on macOS 12+ [assumption: WKWebView matches the Safari version of the OS]. |
| WebKitGTK (Linux) | The context is created, but may be slow | **High risk.** See below. |

Linux facts, all from Tauri's [Linux Graphics Issues](https://v2.tauri.app/develop/debug/linux-graphics/) page:

- WebGL2 context creation "succeeds even when the result is backed by a software rasterizer or a slow presentation path". There is no error to catch.
- WebKitGTK masks `WEBGL_debug_renderer_info` (it reports `Apple GPU`), so the frontend can't detect the real GPU.
- NVIDIA setups can show blank windows or crashes. The workarounds are `__NV_DISABLE_EXPLICIT_SYNC=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1` (costs "the faster rendering path") and `WEBKIT_DISABLE_COMPOSITING_MODE=1` (disables accelerated compositing entirely). The original reports are [tauri#9394](https://github.com/tauri-apps/tauri/issues/9394) and [WebKit bug 261874](https://bugs.webkit.org/show_bug.cgi?id=261874).
- Tauri recommends a non-WebGL fallback on Linux and a user-facing setting to switch, instead of trusting the context.
- In WebKitGTK the `hardware-acceleration-policy` default is `ALWAYS` in the current docs and was `ON_DEMAND` in older ones ([stable](https://webkitgtk.org/reference/webkit2gtk/stable/property.Settings.hardware-acceleration-policy.html), [2.38](https://webkitgtk.org/reference/webkit2gtk/2.38.6/property.Settings.hardware-acceleration-policy.html)).
- Real Tauri apps hit this too. Yaak documents the same env-var fixes ([yaak docs](https://yaak.app/docs/getting-started/linux-graphics-issues)).

Implication: since we can't detect a slow GPU up front, detect it at runtime. Measure frame times for the first ~2 s. If the median is above a threshold (for example 40 ms at the reduced resolution), drop to the static fallback and remember that in prefs [assumption: the threshold needs tuning on the local NVIDIA/Intel machine].

## 3. Approach options

| Option | Bundle | Fit |
|---|---|---|
| **Raw WebGL2, one full-screen triangle** | ~0 KB of deps, ~150 lines of TS plus the shader | **Recommended.** One program, two uniforms groups, no scene graph. |
| OGL ([oframe/ogl](https://github.com/oframe/ogl)) | small (README cites Math at 8 KB gzipped; older copies cite ~20 KB total) | Nice API, but buys nothing for a single quad. |
| three.js / R3F | much larger [assumption: hundreds of KB minified] | Overkill. R3F adds a reconciler. |
| Canvas2D / CSS | 0 | Not "the full effect", but it is the **fallback**. |

Design of the `<ZenBackdrop/>` component:

- **Mounting**: `position: fixed; inset: 0; z-index: -1` (or below the shell), with `pointer-events: none` and `aria-hidden`. The canvas lives in a `ref`, and all GL state lives inside one `useEffect`. Cleanup cancels the rAF, removes listeners, calls `loseContext()` from `WEBGL_lose_context`, and deletes the program and buffers. That keeps React Compiler happy, since there's no render-time mutation.
- **DPR and cost**: render at `min(devicePixelRatio, 1) × 0.5` scale and let CSS upscale it. Water is low-frequency, so blur hides the upscaling. Cap at 30 fps by skipping rAF ticks until 33 ms have passed. Use a `ResizeObserver` for size.
- **Pausing**: stop the loop on `document.visibilitychange` when hidden, and on window blur if wanted. Browsers already throttle rAF in hidden documents ([MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)) [assumption: Tauri webviews behave the same when minimised; verify].
- **Reduced motion**: `matchMedia('(prefers-reduced-motion: reduce)')` → render a single frame at a fixed `t` and stop. Subscribe to `change`.
- **Context loss**: handle `webglcontextlost` with `preventDefault()` and stop the loop, then rebuild on `webglcontextrestored` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)). If the context is lost twice, fall back to static.
- **Fallback chain**: pref `off` → nothing; `static` or no WebGL2 or compile failure or slow → CSS layer; otherwise shader. The CSS layer always renders underneath, so a failed shader shows the fallback rather than a blank screen.
- **Colours**: read `--background` / `--primary` with `getComputedStyle(document.documentElement)` and pass them as `vec3` uniforms. Re-read them when `useColorScheme()` changes.

## 4. Shader technique ("calm water")

Write it ourselves from published techniques. Don't copy Shadertoy code.

1. **Base**: value or simplex noise fBm, 3–4 octaves (cheap). Reference: The Book of Shaders, [noise](https://thebookofshaders.com/11/) and [fBm](https://thebookofshaders.com/13/).
2. **Domain warp**: `f(p + k·fbm(p + t·v))`, using a single warp layer (not double) for slow, liquid drift. Reference: Inigo Quilez, [Domain warping](https://iquilezles.org/articles/warp).
3. **Caustic-like highlights**: take `abs()` of the difference of two warped noise fields, raise it to a power, and use a thin bright band. Run at very low contrast (5–10%) so the UI stays readable.
4. **Surface ripple**: a slow sine swell on the UV before sampling, with time scaled to roughly one cycle per 20–40 s.
5. **Optional mouse ripple**: a decaying radial sine around the last pointer position. The canvas has `pointer-events: none`, so listen on `window`. Keep the amplitude tiny.
6. **Colour**: `mix(bg, mix(bg, primary, 0.15), field)` plus highlight. In dark mode, cap highlight brightness. Add blue-noise dithering to avoid banding [assumption: a hash-based dither is enough].

**Licences**: Shadertoy shaders without an explicit licence are commonly reported to default to **CC BY-NC-SA 3.0**. That is non-commercial and share-alike, so it's incompatible with a paid app. The Shadertoy terms page returned 403 to my fetch, so the claim rests on secondary sources ([example](https://godotshaders.com/shader/water-toon-torrent-shader/)). Re-check directly. Treat Shadertoy water/caustics shaders as visual inspiration only. IQ's articles explain techniques, which is fine to implement from; don't paste his snippets verbatim without checking the licence on that page [assumption].

## 5. Implementation steps

Each step ships on its own and leaves the app working.

**Step 1: Static fallback and the zen-mode shell**
- Goal: a zen-mode toggle (shortcut via `useShortcuts`) that shows a full-screen calm layer, made of a CSS radial/linear gradient from theme tokens with an optional SVG `feTurbulence` texture. No JS animation.
- Files: `src/features/zen/ZenBackdrop.tsx` (fallback only), `src/features/zen/useZenMode.ts`, `src/app/AppShell.tsx`, `src/lib/shortcuts.ts`.
- Acceptance: the toggle shows and hides the backdrop in light and dark; UI stays readable; `pnpm compile && pnpm lint` pass.
- Next step needs: the component path, the mount point in `AppShell`, and the token names used.

**Step 2: Preference and setting**
- Goal: `zenBackdrop: 'auto' | 'shader' | 'static' | 'off'` in prefs, plus a `SettingRow` in Settings.
- Files: `src/lib/preferences.ts`, `src/features/settings/SettingsDialog.tsx`.
- Acceptance: the value persists across reloads; `static`/`off` are respected.
- Next step needs: how to read the pref (`getPreference` / subscribe hook).

**Step 3: WebGL2 bootstrap (solid colour)**
- Goal: `src/features/zen/gl.ts` with `createRenderer(canvas) → { render(t, uniforms), resize(w,h), dispose() } | null`. It covers one full-screen triangle, shader compile and link with error logging, and returns `null` on any failure. The shader outputs `--background`.
- Files: `gl.ts`, `ZenBackdrop.tsx` (canvas layered over the fallback).
- Acceptance: in shader mode the canvas looks identical to the background; forcing a compile error shows the fallback; there are no console errors on unmount/remount (toggle 20×).
- Next step needs: the renderer interface and uniform names.

**Step 4: Render loop and lifecycle**
- Goal: rAF loop capped at 30 fps, rendering at 0.5 scale, sized with `ResizeObserver`; it pauses on `visibilitychange`, renders a single frame under reduced motion, and handles context lost/restored.
- Files: `ZenBackdrop.tsx`, optionally `src/features/zen/loop.ts` (pure, so it's unit-testable).
- Acceptance: a Vitest test for the frame-skip logic; DevTools shows ~30 fps; minimising stops CPU use; the OS reduced-motion setting freezes the animation.
- Next step needs: where `t` and the uniforms are set.

**Step 5: Water shader v1 (warped fBm)**
- Goal: noise, fBm and a single domain warp, coloured from `bg`/`primary` uniforms. Slow drift only.
- Files: `src/features/zen/water.frag.ts` (shader as an exported string).
- Acceptance: it reads visually as calm water in both themes; text contrast on top is unchanged by eye; the slow-motion test means no visible "boiling".
- Next step needs: the shader's uniform list and tuning constants.

**Step 6: Caustics, ripple and dithering**
- Goal: add the highlight band, swell and dither, keeping every constant in one `params` block.
- Files: `water.frag.ts`.
- Acceptance: no banding in dark mode; highlight contrast stays low; fps is unchanged versus step 5.
- Next step needs: the `params` names.

**Step 7: Theme reactivity**
- Goal: re-read the CSS tokens when `useColorScheme()` changes, crossfading the uniforms over ~1 s.
- Files: `ZenBackdrop.tsx`.
- Acceptance: switching the OS theme while in zen mode transitions smoothly.

**Step 8: Slow-GPU guard (Linux)**
- Goal: in `auto`, sample the first ~60 frame times. If the median is over the threshold, switch to static and store `zenBackdrop: 'static'` with a toast saying it can be changed in Settings.
- Files: `ZenBackdrop.tsx`, `loop.ts` (pure median/threshold function with a test).
- Acceptance: a unit test for the decision; artificially slowing the loop (e.g. a busy-wait) triggers the fallback; check on this machine under `WEBKIT_DISABLE_COMPOSITING_MODE=1`.

**Step 9 (optional): Mouse ripple**
- Goal: a decaying ripple from pointer moves, throttled, and off under reduced motion.
- Files: `ZenBackdrop.tsx`, `water.frag.ts`.
- Acceptance: subtle and with no lag; ripple listeners are removed on unmount.

**Step 10: Cross-platform check**
- Goal: run `pnpm tauri dev` on Linux (Intel and NVIDIA offload), plus macOS and Windows if available. Record fps and fallback behaviour in this doc.
- Acceptance: no blank windows; the fallback triggers where needed.

## Open questions

- Is zen mode a route, an overlay over the Today view, or a window-level fullscreen (`getCurrentWindow().setFullscreen`)? This affects the step 1 mount point.
- Is the backdrop allowed behind the normal UI, or only in zen mode? (This doc assumes zen mode only.)
