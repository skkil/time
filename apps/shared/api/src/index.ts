import type { paths } from '#schema';
import createFetchClient from 'openapi-fetch';

export type * from '#schema';

export type ApiErrorKind =
  | 'invalid'
  | 'notFound'
  | 'conflict'
  | 'unauthorized'
  | 'rateLimited'
  | 'database'
  | 'network';

/** The same shape the desktop backend throws, so one error handler serves every app. */
export type ApiError = { kind: ApiErrorKind; message: string };

export type ApiOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  timeZone?: () => string;
  /** Sent as `X-Client-Id`, so this client can ignore change notices for its own writes. */
  clientId?: string;
  onUnauthorized?: () => void;
  fetch?: typeof globalThis.fetch;
};

export const isApiError = (error: unknown): error is ApiError =>
  typeof error === 'object' &&
  error !== null &&
  'kind' in error &&
  'message' in error;

const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function createApi({
  baseUrl,
  getToken,
  timeZone = localTimeZone,
  clientId,
  onUnauthorized,
  fetch,
}: ApiOptions) {
  const client = createFetchClient<paths>({ baseUrl, fetch });
  client.use({
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      request.headers.set('X-Time-Zone', timeZone());
      if (clientId) request.headers.set('X-Client-Id', clientId);
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) onUnauthorized?.();
      return response;
    },
  });
  return client;
}

export type Api = ReturnType<typeof createApi>;

type Problem = { kind?: string; detail?: string; title?: string };

function toApiError(problem: unknown, response: Response): ApiError {
  const body = (problem ?? {}) as Problem;
  const kind = (body.kind ??
    (response.status >= 500 ? 'database' : 'invalid')) as ApiErrorKind;
  return { kind, message: body.detail ?? body.title ?? response.statusText };
}

type Body<T> = [T] extends [undefined] ? null : T;

/** Resolves to the response body (`null` for 204) or throws an {@link ApiError}. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<Body<T>> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await call;
  } catch {
    throw {
      kind: 'network',
      message: 'Can’t reach the server.',
    } satisfies ApiError;
  }
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.error, result.response);
  }
  return (result.data ?? null) as Body<T>;
}
