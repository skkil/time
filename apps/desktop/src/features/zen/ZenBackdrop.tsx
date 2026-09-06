import { useEffect, useState } from 'react';

import { usePreference } from '@/lib/preferences';
import { cn } from '@/lib/utils';

import { rgb, skyAt } from './sky';

const GLOWS = [
  { size: '75vmax', left: '-15%', top: '-20%', drift: 'sky-drift-a 71s' },
  { size: '65vmax', left: '55%', top: '-10%', drift: 'sky-drift-b 89s' },
  { size: '70vmax', left: '-10%', top: '45%', drift: 'sky-drift-c 103s' },
  { size: '60vmax', left: '60%', top: '50%', drift: 'sky-drift-a 97s' },
];

const hourNow = () => {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
};

function useHour() {
  const [hour, setHour] = useState(hourNow);
  useEffect(() => {
    const id = window.setInterval(() => setHour(hourNow()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return hour;
}

const DUSK_HOUR = 19.25;

export function ZenBackdrop({
  deep = false,
  dusk = false,
  className,
}: {
  deep?: boolean;
  dusk?: boolean;
  className?: string;
}) {
  const moving = usePreference('zenBackdrop') === 'motion';
  const hour = useHour();
  const sky = skyAt(dusk ? DUSK_HOUR : hour);

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none inset-0 overflow-hidden', className)}
      style={{
        background: `linear-gradient(180deg, ${rgb(sky.top)} 0%, ${rgb(sky.bottom)} 100%)`,
      }}
    >
      {GLOWS.map((glow, i) => (
        <span
          key={i}
          className="absolute rounded-full motion-reduce:animate-none"
          style={{
            width: glow.size,
            height: glow.size,
            left: glow.left,
            top: glow.top,
            background: `radial-gradient(closest-side, ${rgb(sky.glows[i], 0.85)}, ${rgb(sky.glows[i], 0)})`,
            animation: moving
              ? `${glow.drift} ease-in-out infinite alternate`
              : undefined,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,18,.35)_0%,transparent_45%)]" />
      <div
        className={cn(
          'absolute inset-0 bg-[rgba(4,8,18,.45)] transition-opacity duration-[1200ms]',
          deep ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
