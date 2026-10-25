import { resolve } from 'node:path';

export const ENV_FILE_PATHS = [
  resolve(process.cwd(), '../../docker/.env'),
  resolve(process.cwd(), 'docker/.env'),
];
