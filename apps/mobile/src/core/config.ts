import { makeRedirectUri } from 'expo-auth-session';

function required(name: string, value: string | undefined): string {
  if (!value)
    throw new Error(`${name} is not set. Copy .env.example to .env.local.`);
  return value;
}

export const config = {
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  auth: {
    authority: required(
      'EXPO_PUBLIC_AUTH_AUTHORITY',
      process.env.EXPO_PUBLIC_AUTH_AUTHORITY,
    ),
    clientId: required(
      'EXPO_PUBLIC_AUTH_CLIENT_ID',
      process.env.EXPO_PUBLIC_AUTH_CLIENT_ID,
    ),
    audience: process.env.EXPO_PUBLIC_AUTH_AUDIENCE || undefined,
    redirectUri: makeRedirectUri({ scheme: 'skkiltime', path: 'auth' }),
    postLogoutRedirectUri: makeRedirectUri({ scheme: 'skkiltime' }),
  },
};
