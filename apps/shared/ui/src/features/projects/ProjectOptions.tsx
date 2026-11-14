import { ChevronDownIcon, SettingsIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ProjectOptions({
  showCompleted,
  onShowCompleted,
  onOpenSettings,
}: {
  showCompleted: boolean;
  onShowCompleted: (show: boolean) => void;
  onOpenSettings?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Options
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuCheckboxItem
          checked={showCompleted}
          onCheckedChange={(checked) => onShowCompleted(checked === true)}
        >
          Show completed tasks
        </DropdownMenuCheckboxItem>
        {onOpenSettings && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenSettings}>
              <SettingsIcon />
              Project settings
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
