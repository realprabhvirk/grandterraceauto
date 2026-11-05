import { mergeConfig } from 'vite';
import config from './vite.config.js';

export default mergeConfig(config, {
  server: { port: 5180, strictPort: true },
  cacheDir: 'node_modules/.vite-codex',
});
