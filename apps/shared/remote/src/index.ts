import type { Backend } from '#backend';
import { projects } from '#projects';
import { tasks } from '#tasks';
import type { Api } from '@skkil-time/api';

export type { Backend };

export const createRemoteBackend = (api: Api): Partial<Backend> => ({
  ...projects(api),
  ...tasks(api),
});
