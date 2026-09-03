import type { DayStatus } from '@/bindings';
import { cn } from '@/lib/utils';

export function HabitRing({
  progress,
  status,
  bad,
  children,
  className,
}: {
  progress: number;
  status: DayStatus;
  bad: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const color =
    status === 'failed' || status === 'missed'
      ? 'var(--p1)'
      : status === 'done' || (bad && status === 'pending')
        ? 'var(--due-today)'
        : 'var(--now)';
  const fill = bad ? (status === 'failed' ? 1 : 1 - progress) : progress;

  return (
    <span
      className={cn(
        'relative grid size-9 shrink-0 place-items-center',
        className,
      )}
    >
      <svg
        viewBox="0 0 36 36"
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={
            circumference * (1 - Math.min(1, Math.max(0, fill)))
          }
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="relative" style={{ color }}>
        {children}
      </span>
    </span>
  );
}
