import type { Id, Project } from '@/bindings';

export const PROJECT_COLORS = [
  'graphite',
  'blue',
  'teal',
  'green',
  'olive',
  'amber',
  'rust',
  'plum',
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

export const MAX_PROJECT_DEPTH = 3;

export const projectColorVar = (color: string) =>
  `var(--project-${color}, var(--project-graphite))`;

export type ProjectNode = Project & { depth: number; children: ProjectNode[] };

export type ProjectIndex = {
  byId: Map<Id, ProjectNode>;
  roots: ProjectNode[];
  active: ProjectNode[];
  flat: ProjectNode[];
};

export function buildProjectIndex(projects: Project[]): ProjectIndex {
  const byId = new Map<Id, ProjectNode>();
  for (const project of projects)
    byId.set(project.id, { ...project, depth: 0, children: [] });

  const roots: ProjectNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId === null ? undefined : byId.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const flat: ProjectNode[] = [];
  const visit = (nodes: ProjectNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      flat.push(node);
      visit(node.children, depth + 1);
    }
  };
  visit(roots, 0);

  return { byId, roots, flat, active: flat.filter((node) => !node.archived) };
}

export function descendantIds(node: ProjectNode): Set<Id> {
  const ids = new Set<Id>([node.id]);
  const walk = (current: ProjectNode) => {
    for (const child of current.children) {
      ids.add(child.id);
      walk(child);
    }
  };
  walk(node);
  return ids;
}

export function subtreeHeight(node: ProjectNode): number {
  return 1 + Math.max(0, ...node.children.map(subtreeHeight));
}

export function projectChain(index: ProjectIndex, id: Id): ProjectNode[] {
  const chain: ProjectNode[] = [];
  let current = index.byId.get(id);
  while (current) {
    chain.unshift(current);
    current =
      current.parentId === null ? undefined : index.byId.get(current.parentId);
  }
  return chain;
}

export function projectPath(
  index: ProjectIndex,
  id: Id | null,
  from = 0,
): string {
  if (id === null) return '';
  return projectChain(index, id)
    .slice(from)
    .map((node) => node.name)
    .join(' / ');
}

export function rootOf(index: ProjectIndex, id: Id): ProjectNode | undefined {
  let current = index.byId.get(id);
  while (current && current.parentId !== null) {
    const parent = index.byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export type ProjectTotal = {
  node: ProjectNode | null;
  own: number;
  total: number;
  children: ProjectTotal[];
};

export function rollUpSeconds(
  index: ProjectIndex,
  secondsByProject: Map<Id | null, number>,
): ProjectTotal[] {
  const build = (node: ProjectNode): ProjectTotal => {
    const children = node.children
      .map(build)
      .filter((child) => child.total > 0);
    const own = secondsByProject.get(node.id) ?? 0;
    const total = own + children.reduce((sum, child) => sum + child.total, 0);
    return {
      node,
      own,
      total,
      children: children.sort((a, b) => b.total - a.total),
    };
  };

  const totals = index.roots.map(build).filter((entry) => entry.total > 0);
  const unassigned = secondsByProject.get(null) ?? 0;
  if (unassigned > 0)
    totals.push({
      node: null,
      own: unassigned,
      total: unassigned,
      children: [],
    });
  return totals.sort((a, b) => b.total - a.total);
}

export const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Done' },
  { value: 'dropped', label: 'Dropped' },
] as const;
