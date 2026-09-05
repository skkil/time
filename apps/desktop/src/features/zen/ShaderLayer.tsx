import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { setPreference } from '@/lib/preferences';

import { createPalette, readZenColors } from './colors';
import { type FrameUniforms, type Renderer, createRenderer } from './gl';
import { frameDue, judgeFrames } from './loop';

const RESOLUTION_SCALE = 0.5;
const STILL_TIME = 18;
const RIPPLE_GAP_MS = 1600;
const MAX_CONTEXT_LOSSES = 2;

export function ShaderLayer({
  source,
  guard,
}: {
  source: string;
  guard: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.className =
      'absolute inset-0 size-full transition-opacity duration-1000';
    canvas.style.opacity = '0';
    host.append(canvas);

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const start = performance.now();
    const palette = createPalette(readZenColors(canvas));
    let renderer: Renderer | null = null;
    let frame = 0;
    let last = -Infinity;
    let intervals: number[] = [];
    let judged = !guard;
    let losses = 0;
    let lastRipple = -Infinity;
    let ripple: FrameUniforms['ripple'] = [0.5, 0.5, -1000];

    const still = () => motion.matches;
    const seconds = (now: number) => (now - start) / 1000;
    let visible = false;
    const setVisible = (next: boolean) => {
      if (visible === next) return;
      visible = next;
      canvas.style.opacity = next ? '1' : '0';
    };

    const draw = (now: number) => {
      if (!renderer) return;
      renderer.render({
        time: still() ? STILL_TIME : seconds(now),
        colors: palette.at(now),
        ripple,
      });
      setVisible(true);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const fallBack = () => {
      stop();
      setVisible(false);
      setPreference('zenBackdrop', 'static');
      toast(
        'Zen backdrop switched to still to keep things smooth. Change it in Settings → Rituals.',
      );
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!frameDue(now, last)) return;
      if (!judged && Number.isFinite(last)) {
        intervals.push(now - last);
        const verdict = judgeFrames(intervals);
        if (verdict === 'slow') return fallBack();
        if (verdict === 'smooth') judged = true;
      }
      last = now;
      draw(now);
    };

    const play = () => {
      stop();
      if (!renderer || document.hidden) return;
      if (still()) return draw(performance.now());
      last = -Infinity;
      intervals = [];
      frame = requestAnimationFrame(tick);
    };

    const fit = () => {
      if (!renderer) return;
      const scale =
        Math.min(window.devicePixelRatio || 1, 1) * RESOLUTION_SCALE;
      renderer.resize(canvas.clientWidth * scale, canvas.clientHeight * scale);
      if (!frame && !document.hidden) draw(performance.now());
    };

    const boot = () => {
      renderer = createRenderer(canvas, source, { strict: guard });
      if (!renderer) return setVisible(false);
      fit();
      play();
    };

    const recolor = () => {
      const colors = readZenColors(canvas);
      if (still() || !frame) {
        palette.snapTo(colors);
        if (!document.hidden) draw(performance.now());
      } else {
        palette.fadeTo(colors, performance.now());
      }
    };

    const onPointer = (event: PointerEvent) => {
      if (still() || !frame) return;
      const now = performance.now();
      if (now - lastRipple < RIPPLE_GAP_MS) return;
      lastRipple = now;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      ripple = [
        (event.clientX - rect.left) / rect.width,
        1 - (event.clientY - rect.top) / rect.height,
        seconds(now),
      ];
    };

    const onLost = (event: Event) => {
      event.preventDefault();
      stop();
      setVisible(false);
      renderer = null;
      losses += 1;
    };

    const onRestored = () => {
      if (losses < MAX_CONTEXT_LOSSES) boot();
    };

    const resizer = new ResizeObserver(fit);
    resizer.observe(canvas);

    const classes = new MutationObserver(recolor);
    for (let node = canvas.parentElement; node; node = node.parentElement) {
      classes.observe(node, { attributes: true, attributeFilter: ['class'] });
    }

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    document.addEventListener('visibilitychange', play);
    motion.addEventListener('change', play);
    scheme.addEventListener('change', recolor);
    window.addEventListener('pointermove', onPointer, { passive: true });

    boot();

    return () => {
      stop();
      resizer.disconnect();
      classes.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', play);
      motion.removeEventListener('change', play);
      scheme.removeEventListener('change', recolor);
      window.removeEventListener('pointermove', onPointer);
      renderer?.dispose();
      renderer = null;
      canvas.remove();
    };
  }, [source, guard]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
