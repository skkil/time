import { XIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import type { Id, Quarter } from '@/bindings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DateKey } from '@/lib/time';

import { OutcomeCard } from './OutcomeCard';
import { useCreateOutcome, useRemoveOutcome, useWeek } from './api';

const MAX_OUTCOMES = 3;

export function OutcomePlanner({
  week,
  quarter,
  showTasks = false,
}: {
  week: DateKey;
  quarter: Quarter | null;
  showTasks?: boolean;
}) {
  const { data } = useWeek(week);
  const remove = useRemoveOutcome();
  const outcomes = (data?.outcomes ?? []).filter(
    (outcome) => outcome.status !== 'dropped',
  );
  const open = outcomes.filter((outcome) => outcome.status === 'open').length;

  return (
    <div className="grid gap-2">
      {outcomes.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-md border bg-card">
          {outcomes.map((outcome) => (
            <OutcomeCard
              key={outcome.id}
              outcome={outcome}
              quarter={quarter}
              showTasks={showTasks}
              actions={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove ${outcome.title}`}
                  onClick={() => remove.mutate(outcome.id)}
                >
                  <XIcon />
                </Button>
              }
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Up to 3 outcomes. Phrase each as a finished result, like “Chapter 2
          sent to advisor”. Then link tasks to them from the task details.
        </p>
      )}
      {open < MAX_OUTCOMES && <AddOutcome week={week} quarter={quarter} />}
    </div>
  );
}

function AddOutcome({
  week,
  quarter,
}: {
  week: DateKey;
  quarter: Quarter | null;
}) {
  const create = useCreateOutcome(week);
  const [title, setTitle] = useState('');
  const [priorityId, setPriorityId] = useState<Id | null>(null);
  const priorities = quarter?.priorities ?? [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim())
      create.mutate({ title, priorityId }, { onSuccess: () => setTitle('') });
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={title}
        maxLength={200}
        placeholder="Add an outcome"
        aria-label="New outcome"
        onChange={(event) => setTitle(event.target.value)}
      />
      {priorities.length > 0 && (
        <Select
          value={priorityId === null ? 'none' : String(priorityId)}
          onValueChange={(value) =>
            setPriorityId(value === 'none' ? null : Number(value))
          }
        >
          <SelectTrigger className="w-44" aria-label="Priority it serves">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No priority</SelectItem>
            {priorities.map((priority) => (
              <SelectItem key={priority.id} value={String(priority.id)}>
                {priority.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={!title.trim() || create.isPending}
      >
        Add
      </Button>
    </form>
  );
}
