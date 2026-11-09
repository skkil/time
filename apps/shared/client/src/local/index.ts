import { deviceOnly, mutations, parameters, reads } from '#local/catalog';
import type { Arguments, Engine } from '#local/engine';
import type { commands } from '#types/bindings';

export type { Arguments, Engine };

export type Backend = typeof commands;

export type DeviceCommand = (typeof deviceOnly)[number];

export type DeviceCommands = Pick<Backend, DeviceCommand>;

type Command = (...values: unknown[]) => Promise<unknown>;

const named = (names: readonly string[], values: unknown[]): Arguments =>
  Object.fromEntries(names.map((name, index) => [name, values[index] ?? null]));

const through = (
  engine: Engine,
  kind: 'mutate' | 'query',
  name: keyof Backend,
): Command => {
  const names = parameters[name];
  return (...values) => engine[kind](name, named(names, values));
};

export const createLocalBackend = (
  engine: Engine,
  device: DeviceCommands,
): Backend => {
  const backend: Record<string, Command> = {
    ...(device as unknown as Record<string, Command>),
  };
  for (const name of mutations) backend[name] = through(engine, 'mutate', name);
  for (const name of reads) backend[name] = through(engine, 'query', name);
  return backend as unknown as Backend;
};
