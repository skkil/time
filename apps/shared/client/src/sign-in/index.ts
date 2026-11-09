/**
 * Any OpenID Connect provider works: Auth0 today, the skkil auth service later.
 * Switching provider changes only this configuration.
 */
export type AuthConfig = {
  authority: string;
  clientId: string;
  audience?: string;
  scope?: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
};

export type Session = {
  subject: string;
  email: string | null;
  name: string | null;
};

export interface Auth {
  session(): Promise<Session | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Finishes a sign-in redirect. Resolves `true` when the current URL was a callback. */
  completeSignIn(): Promise<boolean>;
  getToken(): Promise<string | null>;
  subscribe(listener: (session: Session | null) => void): () => void;
}

export const DEFAULT_SCOPE = 'openid profile email offline_access';
