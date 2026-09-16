import { type KeyboardEvent, useRef } from 'react';

import { cn } from '@/lib/utils';

import type { Token } from './parser/types';

export function SmartInput({
  value,
  tokens,
  onChange,
  onIgnore,
  onKeyDown,
  placeholder,
  autoFocus,
  className,
}: {
  value: string;
  tokens: Token[];
  onChange: (value: string) => void;
  onIgnore: (phrase: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const underlay = useRef<HTMLDivElement>(null);
  const segments: { text: string; token: boolean }[] = [];
  let cursor = 0;
  for (const token of tokens) {
    segments.push({ text: value.slice(cursor, token.start), token: false });
    segments.push({ text: value.slice(token.start, token.end), token: true });
    cursor = token.end;
  }
  segments.push({ text: value.slice(cursor), token: false });

  const shared = 'w-full px-0 py-0 leading-6 whitespace-pre';

  return (
    <div className={cn('relative', className)}>
      <div
        ref={underlay}
        aria-hidden
        className={cn(
          shared,
          'pointer-events-none absolute inset-0 z-10 overflow-hidden text-transparent',
        )}
      >
        {segments.map((segment, i) =>
          segment.token ? (
            <mark
              key={i}
              title="Click to keep as plain text"
              onMouseDown={(event) => {
                event.preventDefault();
                onIgnore(segment.text);
              }}
              className="pointer-events-auto cursor-pointer rounded-[3px] bg-now-tint text-transparent shadow-[0_0_0_1px_var(--now-tint)]"
            >
              {segment.text}
            </mark>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </div>
      <input
        autoFocus={autoFocus}
        value={value}
        maxLength={600}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          if (underlay.current)
            underlay.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        className={cn(
          shared,
          'relative bg-transparent outline-none placeholder:text-muted-foreground',
        )}
      />
    </div>
  );
}
