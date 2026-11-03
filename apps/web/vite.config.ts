import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { realpathSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

import { shellFiles } from './shell-files.ts';

const storeClient = realpathSync(
  fileURLToPath(new URL('./node_modules/@skkil/store-client', import.meta.url)),
);

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../shared/app/src', import.meta.url)),
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    shellFiles(),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@skkil-time/core-wasm'] },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), storeClient] },
  },
  build: { sourcemap: true },
});
