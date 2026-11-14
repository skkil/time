import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Id } from '@/backend';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTasks } from '@/features/tasks/api';
import { stepBefore } from '@/lib/reorder';
import { offerUndo, quoted } from '@/lib/undo';
import { cn } from '@/lib/utils';

import { GroupHeading } from './GroupHeading';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectDot } from './ProjectDot';
import {
  useArchiveProject,
  useDeleteProject,
  useProjectIndex,
  useReorderProject,
} from './api';
import { useGroups } from './groups';
import { MAX_PROJECT_DEPTH, type ProjectNode } from './tree';

type DialogState = { parentId: Id | null } | null;

const isInactive = (node: ProjectNode) =>
  node.archived || node.status !== 'active';

export function ProjectNav() {
  const navigate = useNavigate();
  const index = useProjectIndex();
  const groups = useGroups();
  const { data: tasks } = useTasks();
  const [collapsed, setCollapsed] = useState<Set<Id>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<ProjectNode | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const archive = useArchiveProject();
  const reorder = useReorderProject();
  const remove = useDeleteProject();

  const openCounts = useMemo(() => {
    const counts = new Map<Id, number>();
    for (const task of tasks ?? []) {
      if (task.completedAt === null && task.projectId !== null) {
        counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
      }
    }
    return counts;
  }, [tasks]);

  const toggle = (id: Id) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const actions = {
    addChild: (node: ProjectNode) => setDialog({ parentId: node.id }),
    settings: (node: ProjectNode) =>
      void navigate({
        to: '/projects/$projectId',
        params: { projectId: node.id },
        search: { settings: true },
      }),
    archive: (node: ProjectNode, archived: boolean) =>
      archive.mutate(
        { id: node.id, archived },
        {
          onSuccess: () =>
            offerUndo(
              `${archived ? 'Archived' : 'Restored'} ${quoted(node.name)}`,
              () => archive.mutateAsync({ id: node.id, archived: !archived }),
            ),
        },
      ),
    delete: setDeleting,
    move: (node: ProjectNode, before: Id | null) =>
      reorder.mutate({ id: node.id, before }),
  };

  const renderNode = (
    node: ProjectNode,
    _: number,
    siblings: ProjectNode[],
  ) => {
    const children = node.children.filter((child) => !isInactive(child));
    const isCollapsed = collapsed.has(node.id);
    return (
      <li key={node.id}>
        <ProjectRow
          node={node}
          count={openCounts.get(node.id) ?? 0}
          hasChildren={children.length > 0}
          collapsed={isCollapsed}
          onToggle={() => toggle(node.id)}
          actions={actions}
          siblings={siblings.map((sibling) => sibling.id)}
        />
        {children.length > 0 && !isCollapsed && (
          <ul>{children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  const roots = index.roots.filter((node) => !isInactive(node));
  const loose = roots.filter(
    (node) => node.groupId === null || !groups.byId.has(node.groupId),
  );
  const grouped = groups.list
    .map((group) => ({
      group,
      nodes: roots.filter((node) => node.groupId === group.id),
    }))
    .filter(({ nodes }) => nodes.length > 0);

  const archived = index.flat.filter((node) => {
    const parent =
      node.parentId === null ? undefined : index.byId.get(node.parentId);
    return isInactive(node) && (!parent || !isInactive(parent));
  });

  return (
    <section
      aria-labelledby="projects-heading"
      className="flex min-h-0 flex-col"
    >
      <div className="flex items-center justify-between px-2 pb-1">
        <h2
          id="projects-heading"
          className="font-sans text-xs font-semibold text-muted-foreground"
        >
          Projects
        </h2>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="New project"
          onClick={() => setDialog({ parentId: null })}
        >
          <PlusIcon />
        </Button>
      </div>

      <ul className="min-h-0 overflow-y-auto">
        {loose.map(renderNode)}
        {grouped.map(({ group, nodes }) => (
          <li key={group.id}>
            <GroupHeading group={group} />
            <ul>{nodes.map(renderNode)}</ul>
          </li>
        ))}
      </ul>

      {index.active.length === 0 && (
        <button
          type="button"
          onClick={() => setDialog({ parentId: null })}
          className="mx-2 rounded-md border border-dashed px-2 py-2 text-left text-xs text-muted-foreground hover:bg-white/[.06]"
        >
          Add a project to group tasks and time.
        </button>
      )}

      {archived.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="flex w-full items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowArchived((value) => !value)}
          >
            <ChevronRightIcon
              className={cn(
                'size-3 transition-transform',
                showArchived && 'rotate-90',
              )}
            />
            Inactive ({archived.length})
          </button>
          {showArchived && (
            <ul>
              {archived.map((node) => (
                <li key={node.id}>
                  <ProjectRow
                    node={node}
                    count={0}
                    hasChildren={false}
                    collapsed
                    onToggle={() => {}}
                    actions={actions}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <NewProjectDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        parentId={dialog?.parentId ?? null}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes its sub-projects and their tasks. Focus time stays in
              your log without a project. Archive instead to keep everything.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => setDeleting(null),
                })
              }
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type RowActions = {
  move: (node: ProjectNode, before: Id | null) => void;
  addChild: (node: ProjectNode) => void;
  settings: (node: ProjectNode) => void;
  archive: (node: ProjectNode, archived: boolean) => void;
  delete: (node: ProjectNode) => void;
};

function ProjectRow({
  node,
  count,
  hasChildren,
  collapsed,
  onToggle,
  actions,
  siblings = [],
}: {
  node: ProjectNode;
  count: number;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle: () => void;
  actions: RowActions;
  siblings?: Id[];
}) {
  const up = stepBefore(siblings, node.id, -1);
  const down = stepBefore(siblings, node.id, 1);
  return (
    <div
      className="group/row relative flex h-8 items-center rounded-md transition-colors hover:bg-white/[.06] has-[[data-status=active]]:bg-white/[.1] has-[[data-status=active]]:font-medium"
      style={{ paddingLeft: node.archived ? 8 : 8 + node.depth * 14 }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={
            collapsed ? `Expand ${node.name}` : `Collapse ${node.name}`
          }
          aria-expanded={!collapsed}
          onClick={onToggle}
          className="-ml-1 grid size-5 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRightIcon
            className={cn(
              'size-3.5 transition-transform',
              !collapsed && 'rotate-90',
            )}
          />
        </button>
      ) : (
        <span className="-ml-1 size-5" />
      )}
      <Link
        to="/projects/$projectId"
        params={{ projectId: node.id }}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 self-stretch pr-1 outline-none focus-visible:underline',
          node.archived && 'text-muted-foreground',
        )}
      >
        <ProjectDot color={node.color} />
        <span className="truncate">{node.name}</span>
      </Link>
      {count > 0 && (
        <span className="pr-2 text-xs text-muted-foreground group-hover/row:hidden group-has-[[data-state=open]]/row:hidden">
          {count}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`${node.name} options`}
            className="mr-1 hidden group-hover/row:inline-flex focus-visible:inline-flex data-[state=open]:inline-flex"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {node.archived ? (
            <DropdownMenuItem onSelect={() => actions.archive(node, false)}>
              <ArchiveRestoreIcon />
              Restore
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => actions.settings(node)}>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={node.depth + 1 >= MAX_PROJECT_DEPTH}
                onSelect={() => actions.addChild(node)}
              >
                <FolderPlusIcon />
                Add sub-project
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.archive(node, true)}>
                <ArchiveIcon />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={up === undefined}
                onSelect={() => up !== undefined && actions.move(node, up)}
              >
                <ArrowUpIcon />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={down === undefined}
                onSelect={() => down !== undefined && actions.move(node, down)}
              >
                <ArrowDownIcon />
                Move down
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => actions.delete(node)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
