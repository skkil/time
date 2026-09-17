import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type BlockSpan, type Id, type TimeBlock, commands } from '@/bindings';
import { keys } from '@/lib/query';
import { type DateKey, shiftKey } from '@/lib/time';
import { offerUndo, quoted } from '@/lib/undo';

export function useBlocks(monday: DateKey) {
  return useQuery({
    queryKey: keys.blocks(monday),
    queryFn: () => commands.listBlocks(monday, shiftKey(monday, 7)),
  });
}

function useBlockCache(monday: DateKey) {
  const client = useQueryClient();
  const key = keys.blocks(monday);
  return {
    client,
    async freeze() {
      await client.cancelQueries({ queryKey: key });
      return client.getQueryData<TimeBlock[]>(key);
    },
    update(change: (blocks: TimeBlock[]) => TimeBlock[]) {
      client.setQueryData<TimeBlock[]>(key, (blocks) => change(blocks ?? []));
    },
    restore(blocks: TimeBlock[] | undefined) {
      client.setQueryData(key, blocks);
    },
    settle() {
      return client.invalidateQueries({ queryKey: keys.allBlocks });
    },
  };
}

export function useCreateBlock(monday: DateKey) {
  const cache = useBlockCache(monday);
  return useMutation({
    mutationFn: ({ taskId, span }: { taskId: Id; span: BlockSpan }) =>
      commands.createBlock(taskId, span),
    onSuccess: (block) => cache.update((blocks) => [...blocks, block]),
    onSettled: () => cache.settle(),
  });
}

export function useRescheduleBlock(monday: DateKey) {
  const cache = useBlockCache(monday);
  return useMutation({
    mutationFn: ({ id, span }: { id: Id; span: BlockSpan }) =>
      commands.rescheduleBlock(id, span),
    onMutate: async ({ id, span }) => {
      const previous = await cache.freeze();
      cache.update((blocks) =>
        blocks.map((block) =>
          block.id === id
            ? { ...block, startAt: span.startAt, endAt: span.endAt }
            : block,
        ),
      );
      return { previous };
    },
    onSuccess: (block, _vars, context) => {
      const before = context.previous?.find(({ id }) => id === block.id);
      if (!before) return;
      offerUndo(`Moved ${quoted(block.title)}`, async () => {
        await commands.rescheduleBlock(block.id, {
          startAt: before.startAt,
          endAt: before.endAt,
        });
        await cache.settle();
      });
    },
    onError: (_error, _vars, context) => cache.restore(context?.previous),
    onSettled: () => cache.settle(),
  });
}

export function useDeleteBlock(monday: DateKey) {
  const cache = useBlockCache(monday);
  return useMutation({
    mutationFn: (id: Id) => commands.deleteBlock(id),
    onMutate: async (id) => {
      const previous = await cache.freeze();
      cache.update((blocks) => blocks.filter((block) => block.id !== id));
      return { previous };
    },
    onSuccess: (_result, id, context) => {
      const block = context.previous?.find((candidate) => candidate.id === id);
      if (!block) return;
      offerUndo(`Removed the block for ${quoted(block.title)}`, async () => {
        await commands.createBlock(block.taskId, {
          startAt: block.startAt,
          endAt: block.endAt,
        });
        await cache.settle();
      });
    },
    onError: (_error, _id, context) => cache.restore(context?.previous),
    onSettled: () => cache.settle(),
  });
}
