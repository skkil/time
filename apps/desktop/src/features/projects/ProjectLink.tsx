import { Link } from '@tanstack/react-router';
import { ArrowUpRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Id } from '@/bindings';
import { cn } from '@/lib/utils';

const LINK =
  'min-w-0 rounded-sm underline-offset-2 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring';

export function ProjectLink({
  projectId,
  label,
  className,
  children,
}: {
  projectId: Id | null;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const shared = {
    'aria-label': label,
    title: label,
    className: cn(LINK, className),
    onClick: (event: { stopPropagation: () => void }) =>
      event.stopPropagation(),
  };

  return projectId === null ? (
    <Link to="/projects" {...shared}>
      {children}
    </Link>
  ) : (
    <Link to="/projects/$projectId" params={{ projectId }} {...shared}>
      {children}
    </Link>
  );
}

export function ProjectJump({
  projectId,
  name,
}: {
  projectId: Id | null;
  name: string;
}) {
  return (
    <ProjectLink
      projectId={projectId}
      label={`Open ${name}`}
      className="shrink-0 text-foreground/75 hover:text-foreground"
    >
      <ArrowUpRightIcon className="size-4" />
    </ProjectLink>
  );
}
