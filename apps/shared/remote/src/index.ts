import type { Backend, RemoteHost } from '#backend';
import { data } from '#data';
import { projects } from '#projects';
import { records } from '#records';
import { tasks } from '#tasks';
import { workflow } from '#workflow';
import type { Api } from '@skkil-time/api';

export type { Backend, RemoteHost };

export const createRemoteBackend = (
  api: Api,
  host: RemoteHost,
): Partial<Backend> => ({
  ...projects(api),
  ...tasks(api),
  ...records(api),
  ...workflow(api),
  ...data(api, host),
});
