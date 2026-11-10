import { CheckIcon, UploadIcon } from 'lucide-react';
import { type CSSProperties, useRef } from 'react';

import type { Preset } from '@/backend';
import { projectColorVar } from '@/features/projects/tree';
import { cn } from '@/lib/utils';

import { usePresets, useReadPreset } from './api';

export function PresetPicker({
  value,
  onChange,
  color = 'blue',
}: {
  value: Preset | null;
  onChange: (preset: Preset) => void;
  color?: string;
}) {
  const { data: presets = [] } = usePresets();
  const read = useReadPreset();
  const file = useRef<HTMLInputElement>(null);
  const imported = value && !presets.some((p) => p.key === value.key);
  const options = imported ? [...presets, value] : presets;
  const selected = options.find((p) => p.key === (value?.key ?? 'simple'));

  return (
    <div className="grid gap-4">
      <div
        role="radiogroup"
        aria-label="What kind of work is it?"
        className="grid grid-cols-2 gap-3"
        style={{ '--preview': projectColorVar(color) } as CSSProperties}
      >
        {options.map((preset) => {
          const checked = selected?.key === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-describedby={checked ? 'preset-description' : undefined}
              onClick={() => onChange(preset)}
              className={cn(
                'overflow-hidden rounded-2xl bg-white/[.03] text-left ring-1 transition-[box-shadow,background-color] duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                checked
                  ? 'bg-white/[.07] ring-white/45'
                  : 'ring-white/10 hover:ring-white/25',
              )}
            >
              <div
                aria-hidden
                className="h-[76px] border-b border-white/[.06] bg-black/20"
              >
                <Preview preset={preset} />
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">{preset.name}</span>
                {checked && (
                  <CheckIcon className="size-3.5 text-foreground/70" />
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p id="preset-description" className="min-h-4 text-xs text-foreground/75">
        {selected?.description || 'Imported template'}
      </p>
      <button
        type="button"
        onClick={() => file.current?.click()}
        className="flex items-center gap-2 justify-self-start text-xs text-foreground/75 hover:text-foreground"
      >
        <UploadIcon className="size-3.5" />
        Import a template file
      </button>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (event) => {
          const picked = event.target.files?.[0];
          event.target.value = '';
          if (!picked) return;
          read.mutate(await picked.text(), { onSuccess: onChange });
        }}
      />
    </div>
  );
}

const bar = 'h-1.5 rounded-full bg-white/20';
const accent = { background: 'var(--preview)' };

function Preview({ preset }: { preset: Preset }) {
  switch (preset.views[0]?.layout) {
    case 'board':
      return <BoardPreview columns={boardColumns(preset)} />;
    case 'calendar':
      return <CalendarPreview />;
    case 'table':
      return <TablePreview />;
    default:
      return <ListPreview />;
  }
}

const boardColumns = (preset: Preset) =>
  Math.min(
    4,
    Math.max(
      2,
      preset.statuses.filter(
        (status) => !['backlog', 'dropped'].includes(status.category),
      ).length,
    ),
  );

function ListPreview() {
  return (
    <div className="grid h-full content-center gap-2 px-4">
      <span className="h-1.5 w-10 rounded-full" style={accent} />
      {[72, 56, 64].map((width) => (
        <div key={width} className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full ring-1 ring-white/40" />
          <span className={bar} style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}

function BoardPreview({ columns }: { columns: number }) {
  const cards = [2, 3, 1, 1];
  return (
    <div className="flex h-full gap-1.5 p-3">
      {cards.slice(0, columns).map((count, column) => (
        <div
          key={column}
          className="flex flex-1 flex-col gap-1 rounded-md bg-white/[.04] p-1"
        >
          <span
            className="h-1 w-1/2 rounded-full"
            style={
              column === 0 ? accent : { background: 'rgb(255 255 255/.2)' }
            }
          />
          {Array.from({ length: count }, (_, card) => (
            <span key={card} className="h-2.5 rounded-sm bg-white/[.12]" />
          ))}
        </div>
      ))}
    </div>
  );
}

function CalendarPreview() {
  const blocks: Record<number, [number, number][]> = {
    0: [[10, 30]],
    1: [[40, 25]],
    2: [[10, 30]],
    3: [[55, 20]],
    4: [[10, 30]],
  };
  return (
    <div className="grid h-full grid-cols-7 gap-1 p-3">
      {Array.from({ length: 7 }, (_, day) => (
        <div key={day} className="relative rounded-sm bg-white/[.04]">
          {blocks[day]?.map(([top, height]) => (
            <span
              key={top}
              className="absolute inset-x-0.5 rounded-[2px] opacity-80"
              style={{ ...accent, top: `${top}%`, height: `${height}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function TablePreview() {
  return (
    <div className="grid h-full content-center gap-1.5 px-3">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="grid grid-cols-[1fr_.5fr_.4fr] items-center gap-2"
        >
          <span
            className={row === 0 ? 'h-1 rounded-full' : bar}
            style={row === 0 ? accent : undefined}
          />
          <span className={cn(bar, row === 0 && 'h-1 bg-white/30')} />
          <span className={cn(bar, row === 0 && 'h-1 bg-white/30')} />
        </div>
      ))}
    </div>
  );
}
