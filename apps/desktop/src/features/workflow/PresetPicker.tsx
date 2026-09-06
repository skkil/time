import { UploadIcon } from 'lucide-react';
import { useRef } from 'react';

import type { Preset } from '@/bindings';
import { cn } from '@/lib/utils';

import { TypeIcon } from './TypeIcon';
import { usePresets, useReadPreset } from './api';

export function PresetPicker({
  value,
  onChange,
}: {
  value: Preset | null;
  onChange: (preset: Preset) => void;
}) {
  const { data: presets = [] } = usePresets();
  const read = useReadPreset();
  const file = useRef<HTMLInputElement>(null);
  const imported = value && !presets.some((p) => p.key === value.key);
  const options = imported ? [...presets, value] : presets;
  const selected = value?.key ?? 'simple';

  return (
    <div role="radiogroup" aria-label="Set up as" className="grid gap-1.5">
      {options.map((preset) => (
        <button
          key={preset.key}
          type="button"
          role="radio"
          aria-checked={selected === preset.key}
          onClick={() => onChange(preset)}
          className={cn(
            'grid gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors',
            selected === preset.key
              ? 'bg-white/[.1] ring-1 ring-white/30'
              : 'hover:bg-white/[.05]',
          )}
        >
          <span className="text-sm font-medium">{preset.name}</span>
          <span className="text-xs text-foreground/55">
            {preset.description || 'Imported preset'}
          </span>
          {preset.types.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-foreground/45">
              {preset.types.map((type) => (
                <span key={type.name} className="flex items-center gap-1">
                  <TypeIcon icon={type.icon} className="size-3" />
                  {type.name}
                  {type.kind === 'event' && ' (event)'}
                </span>
              ))}
            </span>
          )}
          {preset.views.length > 0 && (
            <span className="text-[11px] text-foreground/35">
              Views: {preset.views.map((view) => view.name).join(', ')}
            </span>
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={() => file.current?.click()}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/50 hover:text-foreground"
      >
        <UploadIcon className="size-3.5" />
        Import a preset file
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
