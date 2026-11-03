import type { EngineError } from '~/engine/protocol';

const isEngineError = (error: unknown): error is EngineError =>
  typeof error === 'object' &&
  error !== null &&
  'kind' in error &&
  typeof error.kind === 'string' &&
  'message' in error &&
  typeof error.message === 'string';

/** Any failure as `{ kind, message }`: the engine's own errors pass through, everything else is a database error. */
export function toEngineError(error: unknown): EngineError {
  if (isEngineError(error)) return { kind: error.kind, message: error.message };
  const message = error instanceof Error ? error.message : String(error);
  return { kind: 'database', message };
}
