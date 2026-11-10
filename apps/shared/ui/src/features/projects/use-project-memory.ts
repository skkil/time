import type { Id } from '@/backend';
import {
  type ProjectViewMemory,
  getPreference,
  setPreference,
  usePreference,
} from '@/lib/preferences';

import { INBOX_KEY } from './project-view';

export function useProjectMemory(projectId: Id | null) {
  const key = projectId === null ? INBOX_KEY : String(projectId);
  const memory = usePreference('projectView')[key] ?? {};
  const remember = (patch: ProjectViewMemory) => {
    const all = getPreference('projectView');
    setPreference('projectView', { ...all, [key]: { ...all[key], ...patch } });
  };
  return { memory, remember };
}
