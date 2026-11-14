import type { Api } from '#server/api';
import type { Backend, RemoteHost } from '#server/backend';
import { calendar } from '#server/calendar';
import { data } from '#server/data';
import { habits } from '#server/habits';
import { places } from '#server/places';
import { projects } from '#server/projects';
import { records } from '#server/records';
import { review } from '#server/review';
import { rituals } from '#server/rituals';
import { tasks } from '#server/tasks';
import { time } from '#server/time';
import { workflow } from '#server/workflow';

export type { Backend, RemoteHost };

export const createRemoteBackend = (api: Api, host: RemoteHost): Backend =>
  ({
    ...projects(api),
    ...places(api),
    ...tasks(api),
    ...records(api),
    ...workflow(api),
    ...habits(api),
    ...time(api),
    ...calendar(api),
    ...review(api),
    ...rituals(api),
    ...data(api, host),
  }) satisfies Backend;
