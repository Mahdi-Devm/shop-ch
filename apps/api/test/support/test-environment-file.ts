import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TEST_ENVIRONMENT_FILE = join(
  tmpdir(),
  'flash-sale-e2e-environment.json',
);
