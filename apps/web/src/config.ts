function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value)
    throw new Error(`${name} is not set. Copy .env.example to .env.local.`);
  return value;
}

const origin = window.location.origin;

export const config = {
  apiUrl: required('VITE_API_URL'),
  auth: {
    authority: required('VITE_AUTH_AUTHORITY'),
    clientId: required('VITE_AUTH_CLIENT_ID'),
    audience: import.meta.env.VITE_AUTH_AUDIENCE || undefined,
    redirectUri: `${origin}/`,
    postLogoutRedirectUri: `${origin}/`,
  },
};
