import { RotateCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PRIORITIES } from '@/features/tasks/meta';
import { usePreference } from '@/lib/preferences';
import { priorityColorValue, setPriorityColor } from '@/lib/priority-colors';

import { SettingRow } from './SettingRow';

export function PrioritySettings() {
  const colors = usePreference('priorityColors');

  return (
    <div>
      {PRIORITIES.map((priority) => (
        <SettingRow
          key={priority}
          label={`Priority ${priority}`}
          description={priority === 4 ? 'Tasks without a priority.' : undefined}
        >
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Reset priority ${priority} colour`}
              disabled={!colors[priority]}
              onClick={() => setPriorityColor(priority, null)}
            >
              <RotateCcwIcon />
            </Button>
            <input
              type="color"
              aria-label={`Priority ${priority} colour`}
              value={colors[priority] ?? priorityColorValue(priority)}
              onChange={(event) =>
                setPriorityColor(priority, event.target.value)
              }
              className="h-8 w-12 cursor-pointer rounded-md border bg-transparent p-0.5"
            />
          </div>
        </SettingRow>
      ))}
    </div>
  );
}
