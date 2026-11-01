/** The desktop `Error` shape, which the shared UI already shows. */
export type CommandError = {
  kind: 'database' | 'invalid' | 'notFound';
  message: string;
};

const KINDS: Record<string, CommandError['kind']> = {
  Database: 'database',
  Invalid: 'invalid',
  NotFound: 'notFound',
};

const isCoreError = (
  error: unknown,
): error is { tag: string; inner: { message: string } } =>
  typeof error === 'object' &&
  error !== null &&
  'tag' in error &&
  typeof error.tag === 'string' &&
  error.tag in KINDS &&
  'inner' in error;

/** Turns a uniffi `CoreError` into `{ kind, message }`; anything else becomes a database error. */
export function toCommandError(error: unknown): CommandError {
  if (isCoreError(error))
    return { kind: KINDS[error.tag], message: error.inner.message };
  return {
    kind: 'database',
    message: error instanceof Error ? error.message : String(error),
  };
}

export function guard<T>(call: () => T): T {
  try {
    return call();
  } catch (error) {
    throw toCommandError(error);
  }
}

export async function guardAsync<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw toCommandError(error);
  }
}
