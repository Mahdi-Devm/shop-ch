import { setTimeout as sleep } from 'node:timers/promises';

export async function waitFor(
  condition: () => Promise<boolean>,
  description: string,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}`);
}
