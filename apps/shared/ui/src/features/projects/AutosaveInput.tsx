import type { ComponentProps } from 'react';

import { Input } from '@/components/ui/input';

import { useAutosave } from './autosave';

export function AutosaveInput({
  value,
  onSave,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'> & {
  value: string;
  onSave: (next: string) => boolean;
}) {
  const draft = useAutosave(value, onSave);
  return (
    <Input
      {...props}
      value={draft.value}
      onChange={(event) => draft.onChange(event.target.value)}
      onBlur={draft.onBlur}
    />
  );
}
