import { useState } from 'react';

import { cn } from '@/lib/utils';

export function InlineRename({
  value,
  label,
  editing,
  onEditingChange,
  onSave,
  className,
  maxLength = 120,
}: {
  value: string;
  label: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSave: (name: string) => void;
  className?: string;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);

  if (!editing)
    return (
      <button
        type="button"
        title={`Rename ${value}`}
        onClick={() => {
          setDraft(value);
          onEditingChange(true);
        }}
        className={cn(
          'min-w-0 cursor-text truncate rounded-sm text-left outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
          className,
        )}
      >
        {value}
      </button>
    );

  const finish = () => {
    const name = draft.trim();
    if (name && name !== value) onSave(name);
    onEditingChange(false);
  };

  return (
    <input
      autoFocus
      value={draft}
      maxLength={maxLength}
      aria-label={label}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(value);
          onEditingChange(false);
        }
      }}
      className={cn(
        'min-w-0 flex-1 rounded-md bg-white/10 px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        className,
      )}
    />
  );
}
