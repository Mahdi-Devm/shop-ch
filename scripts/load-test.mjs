import { randomUUID } from 'node:crypto';
import { resolve4 } from 'node:dns/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const INITIAL_STOCK = 500;
const host = process.env.TARGET_HOST ?? 'order';
const port = process.env.TARGET_PORT ?? '3001';
const buyers = Number(process.env.BUYERS ?? 200);
const runId = Date.now().toString(36);

const replicas = await resolve4(host);

function replicaFor(index) {
  return `http://${replicas[index % replicas.length]}:${port}`;
}

function forwardedIp(index) {
  return `10.${(index >> 16) & 255}.${(index >> 8) & 255}.${index & 255}`;
}

async function call(index, path, { method = 'GET', token, body, headers = {} } = {}) {
  const response = await fetch(`${replicaFor(index)}${path}`, {
    method,
    headers: {
      'X-Forwarded-For': forwardedIp(index),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const indexes = Array.from({ length: buyers }, (_, index) => index);

const tokens = await Promise.all(
  indexes.map(async (index) => {
    const login = await call(index, '/auth/login', {
      method: 'POST',
      body: { username: `load-${runId}-${index}`, password: 'any' },
    });
    return login.body.access_token;
  }),
);

const startedAt = Date.now();
const purchases = await Promise.all(
  indexes.map((index) =>
    call(index, '/api/orders', {
      method: 'POST',
      token: tokens[index],
      headers: { 'Idempotency-Key': randomUUID() },
      body: { productId: PRODUCT_ID, quantity: 1 },
    }),
  ),
);
const burstMs = Date.now() - startedAt;

const responseCounts = {};
for (const purchase of purchases) {
  const key = `${purchase.status} ${purchase.body?.code ?? purchase.body?.status ?? ''}`.trim();
  responseCounts[key] = (responseCounts[key] ?? 0) + 1;
}

const created = indexes.filter((index) => purchases[index].status === 201);
const finalStatuses = new Map();

for (let round = 0; round < 60 && finalStatuses.size < created.length; round += 1) {
  await Promise.all(
    created
      .filter((index) => !finalStatuses.has(index))
      .map(async (index) => {
        const order = await call(index, `/api/orders/${purchases[index].body.orderId}`, {
          token: tokens[index],
        });
        if (order.status === 200 && order.body.status !== 'Pending') {
          finalStatuses.set(index, order.body.status);
        }
      }),
  );
  await sleep(1000);
}

const statusCounts = {};
for (const status of finalStatuses.values()) {
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
}

const product = await call(0, `/api/products/${PRODUCT_ID}`, { token: tokens[0] });
const paidOrReserved = (statusCounts.Paid ?? 0) + (statusCounts.Reserved ?? 0);
const stillPending = created.length - finalStatuses.size;

const summary = {
  replicas: replicas.length,
  buyers,
  burstMs,
  responses: responseCounts,
  orderStatuses: { ...statusCounts, Pending: stillPending },
  productReadModel: product.body,
  paidOrReservedThisRun: paidOrReserved,
};
console.log(JSON.stringify(summary, null, 2));

const violations = [];
if (paidOrReserved > INITIAL_STOCK) {
  violations.push(`Paid + Reserved ${paidOrReserved} exceeds ${INITIAL_STOCK}`);
}
if (product.body.stock < 0) {
  violations.push(`stock is negative: ${product.body.stock}`);
}
if (stillPending > 0) {
  violations.push(`${stillPending} orders never left Pending`);
}

if (violations.length > 0) {
  console.error(`FAILED: ${violations.join('; ')}`);
  process.exit(1);
}
console.log('PASSED: no overselling and stock never negative');
