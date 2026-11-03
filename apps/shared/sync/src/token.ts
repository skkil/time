function payload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded: unknown = JSON.parse(atob(padded));
    return typeof decoded === 'object' && decoded !== null
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The `sub` claim of a JWT without checking its signature: a sync token's `sub` is the account's store scope. */
export function tokenSubject(token: string): string | null {
  const subject = payload(token)?.sub;
  return typeof subject === 'string' && subject !== '' ? subject : null;
}
