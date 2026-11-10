import { URL, fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '~assets': fileURLToPath(new URL('../../assets', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
  },
});
