import { useMutation, useQueryClient } from '@tanstack/react-query';

import { commands } from '@/bindings';
import { keys } from '@/lib/query';
import { todayKey } from '@/lib/time';
import { offerUndo } from '@/lib/undo';

import { countTasks, toImport } from './convert';

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function useImportTasks() {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all(
      [keys.projects, keys.sections, keys.tasks].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    );
  return useMutation({
    mutationFn: async () => {
      const files = await commands.pickImportFiles();
      if (files.length === 0) return null;
      const projects = toImport(files, todayKey());
      if (projects.length === 0)
        throw new Error('No tasks found in those files.');
      const ids = await commands.importProjects(projects);
      return { ids, tasks: countTasks(projects) };
    },
    onSuccess: async (result) => {
      if (!result) return;
      await refresh();
      offerUndo(
        `Imported ${count(result.tasks, 'task')} into ${count(result.ids.length, 'project')}`,
        async () => {
          for (const id of result.ids) await commands.deleteProject(id);
          await refresh();
        },
      );
    },
  });
}
