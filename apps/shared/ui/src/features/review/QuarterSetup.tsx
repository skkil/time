import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type DateKey, mondayOf } from '@/lib/time';

import { useCreatePriority, useSaveQuarter } from './api';
import { quarterLabel } from './format';

const MAX_PRIORITIES = 3;

export function QuarterSetup({
  start: initialStart,
  priorities: initialPriorities = [],
  onDone,
}: {
  start: DateKey;
  priorities?: string[];
  onDone?: () => void;
}) {
  const save = useSaveQuarter();
  const addPriority = useCreatePriority();
  const [start, setStart] = useState(initialStart);
  const [label, setLabel] = useState(quarterLabel(initialStart));
  const [priorities, setPriorities] = useState(
    [...initialPriorities, '', '', ''].slice(0, MAX_PRIORITIES),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      { id: null, label, startDate: mondayOf(start) },
      {
        onSuccess: async (quarterId) => {
          for (const title of priorities.filter((item) => item.trim()))
            await addPriority.mutateAsync({ quarterId, title });
          onDone?.();
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-md border bg-card p-4"
    >
      <p className="text-sm text-muted-foreground">
        Pick up to 3 priorities for the next 13 weeks. Each week’s outcomes can
        serve one of them.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="quarter-label">Name</Label>
          <Input
            id="quarter-label"
            value={label}
            maxLength={40}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="quarter-start">Starts the week of</Label>
          <Input
            id="quarter-start"
            type="date"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setLabel(quarterLabel(event.target.value));
            }}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Priorities</Label>
        {priorities.map((value, i) => (
          <Input
            key={i}
            value={value}
            maxLength={200}
            aria-label={`Priority ${i + 1}`}
            placeholder={i === 0 ? 'e.g. Finish the thesis draft' : 'Optional'}
            onChange={(event) =>
              setPriorities(
                priorities.map((item, j) =>
                  j === i ? event.target.value : item,
                ),
              )
            }
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!label.trim() || !start || save.isPending}
        >
          Start quarter
        </Button>
      </div>
    </form>
  );
}
