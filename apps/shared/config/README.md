# @skkil-time/config

The ESLint, Prettier and TypeScript configs every TypeScript package shares. The
workspace itself is rooted at the repo root:

```bash
pnpm install
pnpm lint | compile | test | format:check   # across every package
```

| Export                                  | Used as                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `@skkil-time/config/eslint`             | `export default config({ ignores })` in each package's `eslint.config.js` |
| `@skkil-time/config/prettier`           | `"prettier"` in each package's `package.json`                             |
| `@skkil-time/config/tsconfig.base.json` | `extends` in each package's `tsconfig`                                    |
