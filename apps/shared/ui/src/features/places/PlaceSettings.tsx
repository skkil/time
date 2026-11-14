import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import type { Place } from '@/backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingRow } from '@/features/settings/SettingRow';
import { useTasks } from '@/features/tasks/api';

import {
  useCreatePlace,
  useDeletePlace,
  usePlaces,
  useRenamePlace,
} from './api';

export function PlaceSettings() {
  const places = usePlaces();
  const { data: tasks } = useTasks();
  const create = useCreatePlace();
  const [name, setName] = useState('');
  const openAt = (place: Place) =>
    (tasks ?? []).filter(
      (task) => task.placeId === place.id && task.completedAt === null,
    ).length;

  return (
    <div>
      {places.list.map((place) => (
        <PlaceRow key={place.id} place={place} open={openAt(place)} />
      ))}
      <SettingRow
        label="Add a place"
        description="Pick it in the task window, or type @ and its name in Quick Add."
      >
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            create.mutate(trimmed, { onSuccess: () => setName('') });
          }}
        >
          <Input
            value={name}
            maxLength={80}
            placeholder="Place name"
            aria-label="New place name"
            className="w-48"
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!name.trim() || create.isPending}
          >
            Add
          </Button>
        </form>
      </SettingRow>
    </div>
  );
}

function PlaceRow({ place, open }: { place: Place; open: number }) {
  const rename = useRenamePlace();
  const remove = useDeletePlace();
  const [renaming, setRenaming] = useState(false);

  return (
    <SettingRow
      label={place.name}
      description={
        open === 0
          ? 'No open tasks'
          : `${open} open task${open === 1 ? '' : 's'}`
      }
    >
      {renaming ? (
        <Input
          autoFocus
          defaultValue={place.name}
          maxLength={80}
          aria-label={`Rename ${place.name}`}
          className="w-48"
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== place.name)
              rename.mutate({ id: place.id, name });
            setRenaming(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setRenaming(false);
          }}
        />
      ) : (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${place.name}`}
            onClick={() => setRenaming(true)}
            className="text-foreground/75"
          >
            <PencilIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${place.name}`}
            onClick={() => remove.mutate(place.id)}
            className="text-foreground/75"
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </SettingRow>
  );
}
