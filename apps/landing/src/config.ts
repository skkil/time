/** Where "Open in your browser" goes: `VITE_APP_URL` at build time, else the web app's dev server. */
export const appUrl: string =
  import.meta.env.VITE_APP_URL ?? 'http://localhost:5173';
