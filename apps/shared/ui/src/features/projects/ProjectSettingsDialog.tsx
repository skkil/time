import type { Project } from '@/backend';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { ProjectSettings } from './ProjectSettings';

export function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        className="flex h-[min(720px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4 sm:px-8 sm:pt-7">
          <DialogTitle className="text-base font-bold">
            {project.name} settings
          </DialogTitle>
          <DialogDescription>Changes save as you make them.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-8">
          <ProjectSettings project={project} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
