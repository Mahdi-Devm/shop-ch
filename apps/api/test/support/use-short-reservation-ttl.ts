export const SHORT_RESERVATION_TTL_MS = 2000;

Object.assign(process.env, {
  RESERVATION_TTL_MS: String(SHORT_RESERVATION_TTL_MS),
});
