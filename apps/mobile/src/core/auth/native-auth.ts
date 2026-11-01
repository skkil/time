import {
  type Auth,
  type AuthConfig,
  DEFAULT_SCOPE,
  type Session,
} from '@skkil-time/auth';
import {
  AuthRequest,
  type DiscoveryDocument,
  ResponseError,
  exchangeCodeAsync,
  fetchDiscoveryAsync,
  refreshAsync,
  revokeAsync,
} from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

type Tokens = {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: number;
};

const STORE_KEY = 'skkil-time.tokens';
const EARLY_SECONDS = 60;

function claims(idToken: string | null): Session | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const body = JSON.parse(atob(payload)) as {
      sub: string;
      email?: string;
      name?: string;
    };
    return {
      subject: body.sub,
      email: body.email ?? null,
      name: body.name ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * The phone's sign-in: OIDC Authorization Code + PKCE in the system browser,
 * tokens in the keychain. The session outlives the network: a refresh that
 * fails offline keeps it, and only the issuer refusing the refresh token
 * signs out.
 */
export function createNativeAuth(config: AuthConfig): Auth {
  const listeners = new Set<(session: Session | null) => void>();
  let discovery: Promise<DiscoveryDocument> | null = null;
  let refreshing: Promise<Tokens | null> | null = null;

  const discover = () =>
    (discovery ??= fetchDiscoveryAsync(config.authority).catch(
      (error: unknown) => {
        discovery = null;
        throw error;
      },
    ));
  const read = async () => {
    const saved = await SecureStore.getItemAsync(STORE_KEY);
    return saved ? (JSON.parse(saved) as Tokens) : null;
  };
  const save = async (tokens: Tokens | null) => {
    if (tokens)
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(STORE_KEY);
    const session = tokens
      ? (claims(tokens.idToken) ?? { subject: '', email: null, name: null })
      : null;
    listeners.forEach((listener) => listener(session));
  };
  const fromResponse = (
    response: {
      accessToken: string;
      refreshToken?: string;
      idToken?: string;
      expiresIn?: number;
      issuedAt: number;
    },
    previous?: Tokens,
  ): Tokens => ({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? previous?.refreshToken ?? null,
    idToken: response.idToken ?? previous?.idToken ?? null,
    expiresAt: response.issuedAt + (response.expiresIn ?? 3600),
  });

  const refresh = (tokens: Tokens) =>
    (refreshing ??= (async () => {
      try {
        if (!tokens.refreshToken) throw new Error('No refresh token');
        const response = await refreshAsync(
          { clientId: config.clientId, refreshToken: tokens.refreshToken },
          await discover(),
        );
        const next = fromResponse(response, tokens);
        await save(next);
        return next;
      } catch (error) {
        if (!tokens.refreshToken || error instanceof ResponseError)
          await save(null);
        return null;
      } finally {
        refreshing = null;
      }
    })());

  const current = async () => {
    const tokens = await read();
    if (!tokens) return null;
    return tokens.expiresAt - EARLY_SECONDS > Date.now() / 1000
      ? tokens
      : refresh(tokens);
  };

  return {
    async session() {
      const tokens = await read();
      return tokens
        ? (claims(tokens.idToken) ?? { subject: '', email: null, name: null })
        : null;
    },
    async signIn() {
      const request = new AuthRequest({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scopes: (config.scope ?? DEFAULT_SCOPE).split(' '),
        usePKCE: true,
        extraParams: config.audience ? { audience: config.audience } : {},
      });
      const result = await request.promptAsync(await discover());
      if (result.type !== 'success') return;
      const response = await exchangeCodeAsync(
        {
          clientId: config.clientId,
          code: result.params.code,
          redirectUri: config.redirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? '' },
        },
        await discover(),
      );
      await save(fromResponse(response));
    },
    async signOut() {
      const tokens = await read();
      await save(null);
      if (tokens?.refreshToken) {
        await revokeAsync(
          { clientId: config.clientId, token: tokens.refreshToken },
          await discover(),
        ).catch(() => undefined);
      }
    },
    completeSignIn: async () => false,
    getToken: async () => (await current())?.accessToken ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
