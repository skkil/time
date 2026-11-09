import {
  type Auth,
  type AuthConfig,
  DEFAULT_SCOPE,
  type Session,
} from '#sign-in/index';
import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts';

const profile = (user: User): Session => ({
  subject: user.profile.sub,
  email: user.profile.email ?? null,
  name: user.profile.name ?? null,
});

const toSession = (user: User | null): Session | null =>
  user && !user.expired ? profile(user) : null;

export type WebAuth = Auth & {
  /** Who last signed in on this browser, even when their tokens ran out; null after signing out. */
  lastSession(): Promise<Session | null>;
};

export function createWebAuth(config: AuthConfig): WebAuth {
  const manager = new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: 'code',
    scope: config.scope ?? DEFAULT_SCOPE,
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    extraQueryParams: config.audience ? { audience: config.audience } : {},
  });

  const fresh = async () => {
    const user = await manager.getUser();
    if (!user || !user.expired) return user;
    return user.refresh_token ? manager.signinSilent().catch(() => null) : null;
  };

  return {
    session: async () => toSession(await fresh()),
    lastSession: async () => {
      const user = await manager.getUser();
      return user ? profile(user) : null;
    },
    signIn: () => manager.signinRedirect(),
    signOut: async () => {
      await manager.removeUser();
      await manager.signoutRedirect().catch(() => undefined);
    },
    async completeSignIn() {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('code') || !params.has('state')) return false;
      await manager.signinRedirectCallback();
      window.history.replaceState(null, '', config.redirectUri);
      return true;
    },
    getToken: async () => (await fresh())?.access_token ?? null,
    subscribe(listener) {
      const loaded = (user: User) => listener(toSession(user));
      const unloaded = () => listener(null);
      manager.events.addUserLoaded(loaded);
      manager.events.addUserUnloaded(unloaded);
      manager.events.addUserSignedOut(unloaded);
      return () => {
        manager.events.removeUserLoaded(loaded);
        manager.events.removeUserUnloaded(unloaded);
        manager.events.removeUserSignedOut(unloaded);
      };
    },
  };
}
