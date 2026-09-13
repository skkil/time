import type { Id, Task } from '@/bindings';

export type GraphEdge = { from: Id; to: Id };

export type GraphLayout = {
  columns: Task[][];
  edges: GraphEdge[];
};

export function dependencyGraph(
  own: Task[],
  byId: Map<Id, Task>,
  holding: Map<Id, Task[]>,
): GraphLayout {
  const open = (task: Task) => task.completedAt === null;
  const nodes = new Map<Id, Task>();
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const link = (from: Task, to: Task) => {
    const key = `${from.id}-${to.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes.set(from.id, from);
    nodes.set(to.id, to);
    edges.push({ from: from.id, to: to.id });
  };

  for (const task of own) {
    if (!open(task)) continue;
    for (const id of task.blockedBy) {
      const blocker = byId.get(id);
      if (blocker) link(blocker, task);
    }
    for (const held of holding.get(task.id) ?? []) {
      if (open(held)) link(task, held);
    }
  }

  const preds = new Map<Id, Id[]>();
  const succs = new Map<Id, Id[]>();
  for (const { from, to } of edges) {
    preds.set(to, [...(preds.get(to) ?? []), from]);
    succs.set(from, [...(succs.get(from) ?? []), to]);
  }

  const layer = new Map<Id, number>();
  const depth = (id: Id): number => {
    const known = layer.get(id);
    if (known !== undefined) return known;
    const value = Math.max(-1, ...(preds.get(id) ?? []).map(depth)) + 1;
    layer.set(id, value);
    return value;
  };
  for (const id of nodes.keys()) depth(id);

  const columns: Task[][] = [];
  for (const task of [...nodes.values()].sort(
    (a, b) => a.position - b.position || a.id - b.id,
  )) {
    const at = layer.get(task.id)!;
    (columns[at] ??= []).push(task);
  }

  const rowOf = () => {
    const rows = new Map<Id, number>();
    columns.forEach((column) =>
      column.forEach((task, row) => rows.set(task.id, row)),
    );
    return rows;
  };
  const sortBy = (column: Task[], neighbours: Map<Id, Id[]>) => {
    const rows = rowOf();
    const centre = (task: Task) => {
      const linked = neighbours.get(task.id) ?? [];
      return linked.length === 0
        ? rows.get(task.id)!
        : linked.reduce((sum, id) => sum + rows.get(id)!, 0) / linked.length;
    };
    column.sort((a, b) => centre(a) - centre(b));
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < columns.length; i++) sortBy(columns[i], preds);
    for (let i = columns.length - 2; i >= 0; i--) sortBy(columns[i], succs);
  }

  return { columns, edges };
}
