/**
 * `unauthorized`: the access token was refused, sign in again.
 * `conflict`: the client id belongs to another account.
 * `unavailable`: the server couldn't be reached or failed.
 */
export type SyncApiErrorKind = 'unauthorized' | 'conflict' | 'unavailable';

export class SyncApiError extends Error {
  readonly kind: SyncApiErrorKind;

  constructor(kind: SyncApiErrorKind, message: string) {
    super(message);
    this.name = 'SyncApiError';
    this.kind = kind;
  }
}

export const isUnauthorized = (error: unknown) =>
  error instanceof SyncApiError && error.kind === 'unauthorized';

export function statusError(status: number, body: string): SyncApiError {
  if (status === 401 || status === 403)
    return new SyncApiError(
      'unauthorized',
      'The sign-in expired. Sign in again.',
    );
  if (status === 409)
    return new SyncApiError(
      'conflict',
      'This device belongs to another account.',
    );
  return new SyncApiError(
    'unavailable',
    `Couldn’t reach the server: HTTP ${status} ${body}`.trim(),
  );
}
