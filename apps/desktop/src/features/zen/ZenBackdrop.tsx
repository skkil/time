import { useEffect, useState } from 'react';

import { usePreference } from '@/lib/preferences';
import { cn } from '@/lib/utils';

import { zenTheme } from './themes';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function useVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return visible;
}

export function ZenBackdrop({
  deep = false,
  className,
}: {
  deep?: boolean;
  className?: string;
}) {
  const mode = usePreference('zenBackdrop');
  const theme = zenTheme(usePreference('zenTheme'));
  const visible = useVisible();
  const [loaded, setLoaded] = useState<string | null>(null);
  const moving = mode === 'motion' && !reducedMotion.matches && visible;

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none inset-0 overflow-hidden', className)}
    >
      <img
        src={theme.poster}
        alt=""
        className="absolute inset-0 size-full scale-105 object-cover"
      />
      {moving && (
        <img
          key={theme.id}
          src={theme.animation}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(theme.animation)}
          className={cn(
            'absolute inset-0 size-full scale-105 object-cover transition-opacity duration-[2000ms]',
            loaded === theme.animation ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,16,24,.72)_0%,rgba(4,16,24,.42)_38%,rgba(4,16,24,.28)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,16,24,.35)_0%,transparent_22%,transparent_70%,rgba(4,16,24,.55)_100%)]" />
      <div
        className={cn(
          'absolute inset-0 bg-[rgba(4,16,24,.55)] backdrop-blur-[6px] transition-opacity duration-[1200ms]',
          deep ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
