import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version?: string };

export const VERSION = packageJson.version ?? '0.0.0';
