# Frontend Architecture — Web

## 1. Purpose

This document describes the frontend structure, component organization, and development conventions of the web application in `apps/web`.

The project combines **Feature-Based Architecture** and **Layered Architecture**. The goal is to keep feature-specific code organized, make shared code reusable, and keep responsibilities clear.

This document describes the structure provided by the project team. Where a convention has not yet been confirmed, it explicitly says so rather than inventing a rule.

## 2. Project Structure

```text
apps/web/
├── .storybook/
├── public/
├── src/
│   ├── app/
│   │   ├── globals.css            # design tokens and global styles
│   │   ├── layout.tsx             # RTL Persian layout, AuthProvider
│   │   ├── page.tsx               # redirects to /product
│   │   ├── login/page.tsx
│   │   ├── product/page.tsx
│   │   └── orders/[id]/page.tsx
│   └── core/
│       ├── assets/
│       ├── components/
│       │   ├── custom/{block,ui}/
│       │   └── shadcn/ui/
│       ├── features/
│       │   ├── auth/              # mock login, session store, AuthProvider
│       │   ├── shop/              # product stock, Quick Buy
│       │   ├── orders/            # live order status over SSE
│       │   └── example/           # placeholder only; not a product feature
│       ├── hooks/
│       ├── lib/
│       │   ├── api/api-client.ts  # shared typed fetch client
│       │   └── basic-link/
│       └── utils/
├── Dockerfile
├── components.json
├── eslint.config.mjs
├── next.config.ts                 # output: standalone
├── package.json
└── tsconfig.json
```

`example/` is a placeholder used to demonstrate the feature structure, not a product feature. It lives at `src/core/features/example/`, not `src/features/example/` as earlier versions of this document said.

## 3. Application Layer — `src/app/`

The `app/` directory contains:

- Application pages and routes.
- Layout files.
- Global files.
- Global CSS.

Its role is to provide the application-level page and layout structure and compose feature components into pages.

Feature-specific implementation should remain in the owning feature when appropriate, rather than being duplicated in page files.

## 4. Core Layer — `src/core/`

The `core/` directory contains shared application resources and the application's feature modules.

### 4.1. `core/assets/`

Contains global assets and resources intended to be used across the application.

Resources that belong exclusively to one feature should remain in that feature's own asset directory.

### 4.2. `core/components/`

Contains globally shared components.

#### `core/components/custom/block/`

Contains larger UI sections composed of multiple smaller components. A complete form section is one example of a block.

#### `core/components/custom/ui/`

Contains smaller shared UI components used to build blocks and other interfaces.

#### shadcn/ui

The project uses shadcn/ui. The exact physical location of generated shadcn components should follow the repository's current configuration; do not create duplicate copies unnecessarily.

### 4.3. `core/features/`

Contains the application's actual feature modules, for example `auth/`, `shop/`, and other product features as they are added.

Each feature should keep its own related implementation and resources together. Do not treat the placeholder `src/core/features/example/` as an actual product feature.

### 4.4. `core/hooks/`

Contains hooks intended for shared use across the application.

Hooks that are only used by one feature should remain local to that feature.

### 4.5. `core/lib/`

Contains shared library code and common functionality. Keep feature-specific implementation in its owning feature unless it is genuinely shared.

### 4.6. `core/utils/`

Contains globally reusable utility functions. Utilities that belong only to one feature should remain within that feature's local `utils/` directory.

## 5. Feature Structure

Actual application features live under `src/core/features/`.

A feature may organize its code into local directories for assets, components, hooks, libraries, utilities, types, mocks, and styles as appropriate to that feature.

The exact internal structure of every feature must be verified from the repository before adding or moving files.

### Feature-local resources

- **Assets:** resources used by the feature.
- **Components:** UI components belonging to the feature.
- **Hooks:** hooks used by the feature.
- **Lib:** feature-specific library code, including API-related code according to the current project convention.
- **Utils:** helper functions used only by the feature.
- **Types, mocks, and styles:** may be local to a feature when they are feature-specific.

Keep feature-specific resources local. Put resources in the global `core` directories only when they are intended to be shared.

## 6. Component Organization

The project distinguishes components by scope and responsibility.

| Location | Responsibility |
|---|---|
| `core/components/custom/ui/` | Smaller globally shared UI components |
| `core/components/custom/block/` | Larger globally shared UI sections |
| `core/features/<feature>/components/ui/` | Smaller feature-specific components, when this structure is used by that feature |
| `core/features/<feature>/components/block/` | Larger feature-specific sections, when this structure is used by that feature |

### Block components

A block is a larger UI section composed of smaller components. For example, a complete form section may be implemented as a block.

### UI components

UI components are smaller building blocks used by blocks and other interfaces.

### Skeleton components

Skeletons for a UI section should be stored in a `skeleton/` directory under the relevant UI directory, following the existing project convention.

## 7. Assets, Types, Mocks, and Styles

The project has both global and feature-local resources.

- **Global resources** belong in the appropriate shared location under `core/`.
- **Feature-specific resources** belong within the owning feature.

This rule applies to assets, fonts, mock data, type definitions, and styles. The precise subdirectory layout should follow the actual repository.

## 8. State Management

The application uses React's built-in state-management capabilities. Do not assume that an external state-management library is part of this architecture.

Keep state close to the components or features that need it, and follow existing patterns for sharing state.

## 9. API Integration

API-related code is organized within the relevant feature.

All HTTP calls go through `src/core/lib/api/api-client.ts`, which reads `NEXT_PUBLIC_API_URL` (empty in Docker, where the API is same-origin behind the gateway) and resolves every call to a typed result carrying the status, the error `code` and `Retry-After` instead of throwing. Each feature wraps the calls it owns in `lib/<feature>-api.ts`.

When adding API functionality:

1. Identify the feature that owns the functionality.
2. Inspect the feature's existing API-related files.
3. Follow its current request, response, and error-handling conventions.
4. Keep feature-specific API logic and types local when appropriate.
5. Put code in shared locations only when it is genuinely shared.

The HTTP client, authentication mechanism, and exact naming conventions must be verified from the repository rather than assumed.

## 10. Challenge Pages: Product and Order

This project implements the `01-challenge-v3-sendaaa` Flash Sale challenge. The challenge names Nuxt 3, but the frontend uses **Next.js**, approved by the challenge organizer; record this in the root `README.md`. The challenge's "Pinia or Composables" requirement maps to React hooks and Context here, with no extra state library.

Only two pages are graded:

| Route | Suggested file | Owning feature |
|---|---|---|
| `/product` | `src/app/product/page.tsx` | `core/features/shop/` (`ProductPanel`, `useProductStock`, `useQuickBuy`) |
| `/orders/[id]` | `src/app/orders/[id]/page.tsx` | `core/features/orders/` (`OrderTracker`, `useOrderStatus`) |
| `/login` | `src/app/login/page.tsx` | `core/features/auth/` (`LoginForm`) |

Pages stay thin and compose feature components. A mock-login flow belongs to `core/features/auth/`. Verify the actual feature folders in the repository before creating new ones.

### 10.1. Backend contract used by the frontend

| Call | Purpose |
|---|---|
| `POST /auth/login` | Mock login, returns `{ access_token, userId }` |
| `GET /api/products/:id` | Returns `{ id, stock, reserved }` |
| `POST /api/orders` | Header `Idempotency-Key` (uuid v4) and `Authorization: Bearer`; body `{ productId, quantity: 1 }` |
| `GET /api/orders/:id` | Current order state (source of truth) |
| `GET /api/orders/:id/events` | SSE stream; `EventSource` cannot set headers, so pass `?token=<JWT>` |

The seeded product id is `11111111-1111-1111-1111-111111111111`. Base URL comes from `NEXT_PUBLIC_API_URL`.

### 10.2. `/product` behavior

- Show current stock (and reserved count) from `GET /api/products/:id`.
- A "Quick Buy" button sends `POST /api/orders` with an `Idempotency-Key` header.
- Generate the key once per purchase intent. If the request is retried because of a network error, reuse the same key; use a new key only for a genuinely new purchase.
- Disable the button after the click so a double click cannot send two requests.
- Handle every response: `201` redirects to `/orders/<orderId>`; `409 DUPLICATE_IDEMPOTENCY_KEY` means the order already exists, so continue to it; `409 SOLD_OUT` shows a "Sold Out" state; `429` shows a retry message using `Retry-After`; `401` sends the user to login; `400` shows a validation error.
- Provide loading, network-error, and sold-out states (use `skeleton/` components for loading).

### 10.3. `/orders/[id]` behavior

- Fetch the current state with `GET /api/orders/:id` first, then open an `EventSource` on `/api/orders/:id/events?token=<JWT>`.
- Each event looks like `{ "status": "Reserved", "version": 2 }`. Apply an event only if its `version` is greater than the version already shown, to ignore stale or duplicate events.
- Show the flow `Pending → Reserved → Paid / Cancelled / Expired`.
- Close the `EventSource` on unmount and when a terminal status (`Paid`, `Cancelled`, `Expired`) is reached.
- On reconnect or error, refetch `GET /api/orders/:id` because the database is the source of truth and SSE is only a live notification channel.
- Show connection-lost and not-found/forbidden states.

### 10.4. Token handling

The access token is used for both the `Authorization` header and the SSE query string. It is kept in memory behind `AuthProvider` with a `sessionStorage` copy for reloads; the decision and its trade-offs are documented in `src/core/features/auth/README.md`. Never log the token or put it in client-visible logs.

## 11. Global and Feature-local Utilities

Use `core/utils/` for utilities intended to be shared across the application.

Use a feature's local `utils/` directory for utilities used only by that feature.

Similarity between two helpers does not automatically mean they should be merged. Scope and ownership determine placement.

## 11a. Design System

Colors, radius and typography come only from the tokens in `src/app/globals.css` (for example `bg-card`, `bg-primary`, `bg-secondary`, `bg-accent`, `text-muted-foreground`, `text-destructive`). The UI copy is Persian and the layout is RTL, following `src/app/layout.tsx`.

## 12. Storybook

The project contains a `.storybook/` directory. Follow its existing configuration and conventions when working with stories or component documentation.

Inspect the current setup before changing configuration or introducing additional tooling.

## 13. Testing

The frontend currently has no established test suite. Do not assume that a specific test runner or testing library is installed or required by the current frontend architecture.

## 14. Root Configuration Files

| File or directory | Responsibility |
|---|---|
| `.storybook/` | Storybook configuration |
| `public/` | Public static assets |
| `.gitignore` | Git ignore rules |
| `README.md` | Project overview and setup instructions |
| `components.json` | UI component generator configuration, including shadcn/ui settings |
| `eslint.config.mjs` | ESLint configuration |
| `next.config.ts` | Next.js configuration |
| `package.json` | Package metadata, dependencies, and scripts |
| `pnpm-lock.yaml` | Locked dependency versions |
| `pnpm-workspace.yaml` | pnpm workspace configuration |
| `postcss.config.mjs` | PostCSS configuration |
| `tsconfig.json` | TypeScript configuration |

## 15. Development Guidelines

1. Inspect the existing repository before creating directories or files.
2. Place actual application features under `src/core/features/`.
3. Treat `src/core/features/example/` as a placeholder/example structure only; do not implement product functionality there unless explicitly instructed.
4. Keep feature-specific code and resources within the owning feature.
5. Use shared `core` resources only when they are genuinely shared.
6. Use `block/` for larger UI sections and `ui/` for smaller components.
7. Place Skeleton components under the relevant UI directory.
8. Follow the feature's existing API conventions.
9. Use React's built-in state-management capabilities and follow existing project patterns.
10. Preserve existing naming and import conventions.
11. Avoid unnecessary dependencies, duplicate components, and unrelated refactors.
12. Do not assume a file, library, or convention exists without checking the repository.
13. Update this document when the actual architecture or established conventions change.

## 16. Coding Agent Instructions

Before changing the frontend, a coding agent must:

- Inspect the relevant source directories and current implementations.
- Determine whether the requested code belongs to `app/`, a shared `core` directory, or a feature under `core/features/`.
- Treat `features/example/` as illustrative only, not as a real feature.
- Reuse existing components where appropriate.
- Avoid creating duplicate shared components or moving feature-local code into global directories without a reason.
- Avoid changing unrelated features.
- Avoid introducing unrequested libraries or architectural patterns.
- Verify current package scripts and configuration before changing tooling.
- Keep documentation aligned with the repository's actual structure.

When a convention is not described here, inspect existing code and ask for clarification if the correct behavior cannot be determined safely.

## 17. Maintenance

This document should be updated whenever the directory structure, component conventions, API organization, or other established frontend rules change.

The repository is the source of truth for current file locations and runtime behavior.
