import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

const SHELL = /\.(js|css|wasm)$/;

/**
 * Writes `shell-files.json`: every script, stylesheet and wasm module the build emitted, the engine
 * worker's included, so the service worker can keep the whole app for offline starts.
 */
export function shellFiles(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'skkil-time:shell-files',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const out = resolve(config.root, config.build.outDir);
      const dir = config.build.assetsDir;
      const files = readdirSync(join(out, dir))
        .filter((file) => SHELL.test(file))
        .map((file) => `/${dir}/${file}`);
      writeFileSync(join(out, 'shell-files.json'), JSON.stringify(files));
    },
  };
}
