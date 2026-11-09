import { writeFileSync } from 'node:fs';

import { renderCss } from '#css';

writeFileSync(new URL('../tokens.css', import.meta.url), renderCss());
