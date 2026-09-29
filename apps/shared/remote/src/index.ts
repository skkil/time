import type { Backend } from '#backend';
import { habits } from '#habits';
import { projects } from '#projects';
import { records } from '#records';
import { tasks } from '#tasks';
import { workflow } from '#workflow';
import type { Api } from '@skkil-time/api';

export type { Backend };

export const createRemoteBackend = (api: Api): Partial<Backend> => ({
  ...projects(api),
  ...tasks(api),
  ...records(api),
  ...workflow(api),
  ...habits(api),
});
