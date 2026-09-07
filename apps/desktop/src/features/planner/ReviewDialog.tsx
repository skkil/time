import { useState } from 'react';

import type { WeekNotes } from '@/bindings';
import { FeltScale } from '@/components/FeltScale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useRateWeek, useSaveWeekNotes, useWeek } from '@/features/review/api';
import { type DateKey, formatWeekRange, isoWeekNumber } from '@/lib/time';

const FIELDS: { key: keyof WeekNotes; label: string }[] = [
  { key: 'worked', label: 'What worked' },
  { key: 'fellShort', label: 'What fell short' },
  { key: 'change', label: 'One change' },
];

export function ReviewDialog({
  week,
  open,
  onOpenChange,
}: {
  week: DateKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[84vh] flex-col gap-6 rounded-[32px] border-0 bg-[rgba(10,18,32,.92)] p-10 ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-xl">
        <div>
          <DialogTitle className="text-3xl font-light">
            Week {isoWeekNumber(week)}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-foreground/50">
            {formatWeekRange(week)}
          </DialogDescription>
        </div>
        {open && <ReviewForm week={week} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ReviewForm({ week, onDone }: { week: DateKey; onDone: () => void }) {
  const { data } = useWeek(week);
  const rate = useRateWeek(week);
  const save = useSaveWeekNotes(week);
  const [felt, setFelt] = useState<number | null>(data?.felt ?? null);
  const [notes, setNotes] = useState<WeekNotes>(
    data?.notes ?? { worked: '', fellShort: '', change: '' },
  );

  const submit = async () => {
    if (felt !== null && felt !== data?.felt) await rate.mutateAsync(felt);
    if (FIELDS.some(({ key }) => notes[key] !== data?.notes[key]))
      await save.mutateAsync(notes);
    onDone();
  };

  return (
    <>
      <div className="grid min-h-0 gap-5 overflow-y-auto">
        <FeltScale
          size="sm"
          label="How the week felt"
          value={felt}
          onChange={setFelt}
        />
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="grid gap-1.5">
            <span className="text-sm text-foreground/55">{label}</span>
            <Textarea
              rows={2}
              maxLength={2000}
              value={notes[key]}
              onChange={(event) =>
                setNotes({ ...notes, [key]: event.target.value })
              }
            />
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={rate.isPending || save.isPending} onClick={submit}>
          Save
        </Button>
      </div>
    </>
  );
}
