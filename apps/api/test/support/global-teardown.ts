import { rmSync } from 'node:fs';
import { TEST_ENVIRONMENT_FILE } from './test-environment-file';

export default async function globalTeardown(): Promise<void> {
  await Promise.all(
    (globalThis.e2eContainers ?? []).map((container) => container.stop()),
  );
  rmSync(TEST_ENVIRONMENT_FILE, { force: true });
}
