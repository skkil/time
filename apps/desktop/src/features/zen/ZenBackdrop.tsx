import { usePreference } from '@/lib/preferences';
import { cn } from '@/lib/utils';

import { ShaderLayer } from './ShaderLayer';
import { zenTheme } from './themes';

export function ZenBackdrop({ className }: { className?: string }) {
  const mode = usePreference('zenBackdrop');
  const theme = zenTheme(usePreference('zenTheme'));
  const shader =
    mode === 'auto' || mode === 'shader' ? theme.shader : undefined;

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className,
      )}
    >
      {mode === 'off' ? (
        <div className="absolute inset-0 bg-background" />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ backgroundImage: theme.staticBackground }}
          />
          {shader && (
            <ShaderLayer
              key={theme.id}
              source={shader}
              guard={mode === 'auto'}
            />
          )}
          <svg className="absolute inset-0 size-full opacity-[0.07] mix-blend-soft-light">
            <filter id="zen-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#zen-grain)" />
          </svg>
        </>
      )}
    </div>
  );
}
