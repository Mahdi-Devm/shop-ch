# Secure Multi-Tenant Assessment API

A secure, tenant-isolated backend for a multi-tenant assessment dashboard, built with NestJS, TypeORM, PostgreSQL, and Redis.

## Security features

- **Authentication**: Phone + OTP login (bcrypt-hashed OTPs), JWT access tokens, encrypted refresh tokens.
- **Refresh token rotation**: each refresh rotates the token within a "family"; reusing a rotated token revokes the entire family.
- **RBAC**: three roles (`ADMIN`, `ANALYST`, `VIEWER`) mapped to granular permissions via `ROLE_PERMISSIONS` (with inheritance).
- **Tenant isolation**: `orgId` is always taken from the verified JWT (never from the body/query/params). Cross-tenant access returns `404`.
- **Hardening**: helmet, CORS allow-list (`CORS_ORIGIN`), rate limiting (Redis-backed), `httpOnly`/`sameSite=lax`/`secure`-from-env cookies, global exception filter (no stack traces leaked).

## Requirements

- Node.js + pnpm
- PostgreSQL (default `localhost:15432`)
- Redis (default `localhost:6379`)

## Setup

```bash
cp .env.example .env   # then fill in secrets / connection URLs
pnpm install
```

## Run

```bash
pnpm run dev        # watch mode
pnpm run start      # production start
pnpm run build      # compile to dist/
```

## Seed

```bash
pnpm run seed
```

The seed is idempotent and creates three organizations with sample users, projects, findings, and activities.

### Seeded users

| Organization | Role    | Name            | Phone       |
| ------------ | ------- | --------------- | ----------- |
| Org A        | ADMIN   | Ali Ahmadi      | 09911110001 |
| Org A        | ANALYST | Sara Mohammadi  | 09911110002 |
| Org A        | VIEWER  | Reza Karimi     | 09911110003 |
| Org B        | ADMIN   | Maryam Hosseini | 09922220001 |
| Org B        | ANALYST | Hossein Rezaei  | 09922220002 |
| Org B        | VIEWER  | Zahra Naderi    | 09922220003 |
| Org C        | ADMIN   | Amir Taheri     | 09933330001 |
| Org C        | ANALYST | Neda Safari     | 09933330002 |
| Org C        | VIEWER  | Kaveh Moradi    | 09933330003 |

Roles: `ADMIN`, `ANALYST`, `VIEWER`.

### Login flow

1. `POST /auth/request-otp` with `{ "phone": "09911110001" }`.
2. `POST /auth/vrify-otp` with `{ "phone": "09911110001", "otp": "<code>" }`.

In development/test (`NODE_ENV` is `development` or `test`), the OTP is fixed to the value of `DEV_OTP` (default `00000`), and the code is also returned in the response body for convenience. In production a random code is generated and (in a real deployment) would be delivered out-of-band.

## Roles & permissions

| Permission       | VIEWER | ANALYST | ADMIN |
| ---------------- | :----: | :-----: | :---: |
| `dashboard:read` | ✅     | ✅      | ✅    |
| `project:read`   | ✅     | ✅      | ✅    |
| `member:read`    | ✅     | ✅      | ✅    |
| `activity:read`  | ✅     | ✅      | ✅    |
| `finding:read`   | ✅     | ✅      | ✅    |
| `finding:create` | ❌     | ✅      | ✅    |
| `finding:update` | ❌     | ✅      | ✅    |
| `finding:delete` | ❌     | ❌      | ✅    |
| `member:manage`  | ❌     | ❌      | ✅    |

## Endpoints

- `POST /auth/request-otp`, `POST /auth/vrify-otp`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/summary-user`
- `GET /projects`, `GET /projects/:id`, `GET /projects/:id/members`
- `GET /findings`, `GET /findings/:id`, `POST /findings`, `PATCH /findings/:id`, `DELETE /findings/:id`
- `GET /dashboard/summary`, `GET /dashboard/trend`, `GET /dashboard/activities`

## Tests

```bash
pnpm run test        # unit tests
pnpm run test:e2e    # end-to-end (security & multi-tenancy)
pnpm run lint        # eslint
```
