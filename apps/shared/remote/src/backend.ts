import type { Api } from '@skkil-time/api';
import type { commands } from '@skkil-time/contract';

export type Backend = typeof commands;

export type Commands<K extends keyof Backend> = (api: Api) => Pick<Backend, K>;
