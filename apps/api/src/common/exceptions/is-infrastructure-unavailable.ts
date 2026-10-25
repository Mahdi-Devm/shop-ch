const UNAVAILABLE_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  '57P01',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08006',
]);

const UNAVAILABLE_MESSAGE_PATTERN =
  /connection terminated|connection timeout|channel closed|not connected/i;

export function isInfrastructureUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorCode = (error as Error & { code?: unknown }).code;
  if (typeof errorCode === 'string' && UNAVAILABLE_ERROR_CODES.has(errorCode)) {
    return true;
  }

  return UNAVAILABLE_MESSAGE_PATTERN.test(error.message);
}
