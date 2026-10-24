# Frontend Structure — apps/web (Secure Multi-Tenant Assessment Dashboard)

> Source-of-truth context for all future frontend work. Read this before implementing.
> Status legend used on every node/file: **✅ EXISTS** (verified in repo) or **🔲 PLANNED** (to be created; follows the architecture below).
> Backend is `apps/api` (NestJS) — read-only from the frontend's perspective. Real security is enforced by the backend; the frontend only improves UX.

---

## 1. Overview

`apps/web` is the Next.js client for the "Secure Multi-Tenant Assessment Dashboard". The app lives inside a pnpm + Turborepo monorepo (workspaces `apps/*`, `packages/*`).

### Stack (exact installed versions)

| Concern | Package | Version (package.json) | Status |
|---|---|---|---|
| Framework | `next` | `16.2.5` (App Router) | ✅ |
| UI runtime | `react` / `react-dom` | `19.2.4` | ✅ |
| Language | `typescript` | `^5` (`strict: true`) | ✅ |
| Styling | `tailwindcss` | `^4` (via `@tailwindcss/postcss`) | ✅ |
| Components | shadcn/ui (Radix) | `class-variance-authority ^0.7.1`, `radix-ui ^1.6.7`, `lucide-react ^1.39.0`, `tailwind-merge ^3.6.0`, `clsx ^2.1.1`, `input-otp ^1.4.2` | ✅ |
| Client state | `zustand` | `^5.0.15` | ✅ (store currently empty) |
| Server state | `@tanstack/react-query` | — | 🔲 **NOT installed yet** |
| Validation | `zod` | `^4.4.3` | ✅ (minimal helpers only) |
| Forms | `react-hook-form` + `@hookform/resolvers` | — | 🔲 **NOT installed yet** |
| Charts | `recharts` | — | 🔲 **NOT installed yet** |
| Toasts | `sonner` | `^2.0.8` | ✅ |
| Loader | `nextjs-toploader` | `^3.9.17` | ✅ |
| Debounce | `use-debounce` | `^10.1.1` | ✅ |
| Storybook | `storybook` | `^10.4.0` (`@storybook/nextjs-vite`) | ✅ (config only, no domain stories) |
| Test runner | `vitest` | `^5.0.0` (`jsdom`) | ✅ |
| Testing lib | `@testing-library/react ^16.3.3`, `jest-dom ^7.0.1`, `user-event ^14.6.7` | — | ✅ |
| API mocking | `msw` | — | 🔲 **NOT installed yet** |

### Current implementation status

| Area | State |
|---|---|
| App shell / root layout | ✅ Config bootstrapped; `layout.tsx` is RTL Persian + top loader + `sonner` toaster. |
| Login / OTP / auth | 🔲 Not implemented. Backend endpoints exist; frontend has only a dead `getErrorMessage.ts` helper + leftover cookie helpers. |
| Dashboard / Projects / Findings pages | 🔲 Not implemented. `app/` has a single placeholder `page.tsx`. |
| Route groups / protected routes / middleware | 🔲 Not implemented. |
| API client / TanStack Query wiring | 🔲 Not implemented. Only `BASE_URL` constant exists. |
| Zustand stores | 🔲 `store/test.store.ts` is empty (0 lines). |
| shadcn primitives | ✅ 21 primitives present under `src/core/components/shadcn/ui`. |
| Shared/reusable components | 🟡 Partial — existing `custom/` holds unrelated leftovers (Persian e-commerce panel). See §7. |
| Storybook stories | 🟡 A few shadcn primitives have `.stories.tsx`; no domain components. |
| Unit tests | 🟡 `vitest` wired; 4 test files exist (helpers only). |

> **Important context:** the committed `src/core/**` scaffold was carried over from a **different project** (a Persian/RTL e-commerce + admin panel). It contains dead/broken files (see §12). The conventions in this document intentionally reconcile the existing `src/core` layout with the assessment-dashboard target architecture.

---

## 2. Directory tree

```
apps/web
├── 📄 package.json                        ✅ scripts + deps
├── 📄 tsconfig.json                       ✅ strict, path aliases (@/*, @/core/*, @/components/*, @/shadcn/*)
├── 📄 next.config.ts                      ✅ empty (defaults)
├── 📄 components.json                     ✅ shadcn config (style "base-nova", RSC on)
├── 📄 postcss.config.mjs                  ✅ @tailwindcss/postcss
├── 📄 eslint.config.mjs                   ✅ flat config (eslint-config-next + typescript)
├── 📄 vitest.config.ts                    ✅ jsdom + setupFiles src/core/test/setup.ts
├── 📄 next-env.d.ts                       ✅ generated
├── 📄 .gitignore                          ✅
├── 📄 .env / .env.example                 ✅ NEXT_PUBLIC_BACK_URL (see §10 — mismatch)
├── 📄 README.md                           ✅ default create-next-app
├── 📁 .storybook/                         ✅ main.ts + preview.tsx (addons: a11y, docs, vitest, onboarding)
├── 📁 public/                             ✅ default SVG assets only
└── 📁 src/
    ├── 📁 app/                            ✅ App Router root
    │   ├── layout.tsx                     ✅ RootLayout (RTL fa, Rubik, NextTopLoader, sonner Toaster)
    │   ├── page.tsx                       ✅ placeholder ("page")
    │   ├── globals.css                    ✅ Tailwind v4 @theme tokens (brand #ffa00a), .dark, scrollbar, helpers
    │   ├── favicon.ico                    ✅
    │   ├── middleware.ts                  🔲 auth/session guard (redirect + refresh orchestration)
    │   ├── (auth)/                        🔲 route group (public)
    │   │   ├── layout.tsx                 🔲 centered auth shell
    │   │   └── login/page.tsx             🔲 phone → OTP login flow
    │   ├── (dashboard)/                   🔲 route group (protected)
    │   │   ├── layout.tsx                 🔲 AppShell (Sidebar + Header) + auth boundary
    │   │   ├── page.tsx                   🔲 dashboard home
    │   │   ├── loading.tsx                🔲 skeleton
    │   │   ├── error.tsx                  🔲 error boundary
    │   │   ├── not-found.tsx              🔲 404
    │   │   ├── projects/page.tsx          🔲 list (search/filter/pagination)
    │   │   ├── projects/[id]/page.tsx     🔲 detail + members
    │   │   ├── findings/page.tsx          🔲 list (search/filter/pagination)
    │   │   ├── findings/new/page.tsx      🔲 create finding
    │   │   └── findings/[id]/page.tsx     🔲 detail / edit (admin+analyst)
    │   └── api/                           🔲 (optional) route handlers if BFF needed
    └── 📁 core/                           ✅ existing convention root (maps to @/core/*)
        ├── 📁 assets/                     ✅
        │   ├── @types/                    ✅ legacy types (PaginationType, sortBy, Typography, gender.enum)
        │   ├── mock/navItems.ts           ✅ leftover admin-panel nav (unrelated)
        │   └── style/fonts/               ✅ Rubik local fonts + font.ts
        ├── 📁 components/                 ✅
        │   ├── shadcn/ui/                 ✅ 21 shadcn primitives (badge..tooltip)
        │   └── custom/                    ✅ custom (mostly leftover e-commerce)
        │       ├── blook/                 ✅ header/footer/sidebar (some broken)
        │       └── ui/                    ✅ modal, pagination, search-input, tagInput, typography, logo, image, wrapper
        ├── 📁 features/                   ✅ feature-based modules (scaffold)
        │   ├── auth/                      ✅ scaffold only (getErrorMessage test)
        │   ├── example/                   ✅ placeholder scaffold (delete)
        │   ├── projects/                  🔲 feature: list/detail/members
        │   ├── findings/                  🔲 feature: list/detail/form
        │   └── dashboard/                 🔲 feature: summary/trend/activities
        ├── 📁 hooks/                      ✅ useIsMobile, useUpdateQuery (+ planned data hooks)
        ├── 📁 lib/                        ✅ basic-link, coockie, revalidate, token, zod
        │   └── api/                       🔲 client.ts + endpoints/* + query/*
        ├── 📁 store/                      ✅ test.store.ts (empty); plan auth.store + ui.store
        ├── 📁 test/                       ✅ setup.ts, example.test.tsx, TestButton.tsx
        ├── 📁 types/                      🔲 API types, Permission/Role unions, entity types
        ├── 📁 mocks/                      🔲 MSW handlers + fixtures
        └── 📁 utils/                      ✅ formatDate, formatZodErrors, getsortBy, shadcn/utils
```

Path aliases (from `tsconfig.json`) — **use these, never relative paths across boundaries:**

| Alias | Target |
|---|---|
| `@/*` | `./src/*` |
| `@/core/*` | `./src/core/*` |
| `@/components/*` | `./src/core/components/*` |
| `@/shadcn/*` | `./src/core/components/shadcn/ui/*` |

---

## 3. File-by-file reference

### 3.1 Root config (apps/web)

| Path | Status | Purpose | Key exports / notes |
|---|---|---|---|
| `package.json` | ✅ | Dependencies + scripts. `name:"frontend"`, `version:"0.1.0"`. See §10 scripts. Missing: `@tanstack/react-query`, `react-hook-form`, `recharts`, `msw`. | — |
| `tsconfig.json` | ✅ | `strict:true`, `moduleResolution:"bundler"`, `jsx:"react-jsx"`. Defines the 4 aliases above. | — |
| `next.config.ts` | ✅ | Empty config object. Add cross-origin `eslint`/`images` if needed. | — |
| `components.json` | ✅ | shadcn config: style `base-nova`, `rsc:true`, `css:"app/globals.css"` (⚠ actually lives at `src/app/globals.css`), base color `neutral`, icon `lucide`. | aliases point into `@/core/...` |
| `postcss.config.mjs` | ✅ | Only `@tailwindcss/postcss`. | — |
| `eslint.config.mjs` | ✅ | Flat config: `eslint-config-next/core-web-vitals` + `typescript`. | — |
| `vitest.config.ts` | ✅ | `environment:"jsdom"`, `setupFiles: ["./src/core/test/setup.ts"]`. | — |
| `.storybook/main.ts` | ✅ | Framework `@storybook/nextjs-vite`; stories glob `../src/**/*.stories.*`; staticDirs `../public`. | — |
| `.storybook/preview.tsx` | ✅ | Imports globals.css; `nextjs.appDirectory:true`; `tags:["autodocs"]`. | — |

### 3.2 src/app

| Path | Status | Purpose | Responsibilities | Key exports | Used by |
|---|---|---|---|---|---|
| `layout.tsx` | ✅ | Root layout. `html lang="fa" dir="rtl"`, Rubik font var, `<NextTopLoader color="#ffa00a">`, `<Toaster/>`. | Global providers/shell. | `RootLayout` (server) | all routes |
| `page.tsx` | ✅ | Placeholder returning `<div>page</div>`. | **Must be deleted** before adding `(dashboard)/page.tsx`, or both would resolve `/` (ambiguous route → build error). | default | `/` |
| `globals.css` | ✅ | Tailwind v4 tokens + `@theme inline` color/radius mapping, `.dark`, scrollbar, `.pages-container`, `.section-layout`, `fade-in-up`. | Design tokens (`--color-brand:#ffa00a` etc.). | — | global |
| `middleware.ts` | 🔲 | Auth/session guard. **Server-side.** | (1) read refresh cookie, (2) if no session → redirect `/login?reason=...` for protected routes, (3) if access expired → attempt single refresh → rewrite/proxied cookie, (4) allow `/login` for guests and redirect authenticated users away from `/login`. Keep logic thin; heavy work stays in client/endpoints. | `middleware` | all routes |
| `(auth)/layout.tsx` | 🔲 | Centered public layout (no sidebar/header). | Render children in a centered card. | `default` | `(auth)/*` |
| `(auth)/login/page.tsx` | 🔲 | Login page. Server component wrapping a client `<LoginForm>` from `features/auth`. | Phone input → `request-otp` → OTP input → `verify-otp` → set session → redirect `/`. | `default` | `/login` |
| `(dashboard)/layout.tsx` | 🔲 | Protected app shell. Server component; checks session, renders `<AppShell>`. | Guard + `<Sidebar>` + `<Header>` + `{children}`. | `default` | `(dashboard)/*` |
| `(dashboard)/page.tsx` | 🔲 | Dashboard home. | Renders `features/dashboard` summary cards + trend chart + activities feed. | `default` | `/` |
| `(dashboard)/loading.tsx` | 🔲 | Root suspense skeleton. | — | `default` | `(dashboard)` |
| `(dashboard)/error.tsx` | 🔲 | Client error boundary (`"use client"`). | `error`/`reset` props, "Reload" button. | `default` | `(dashboard)` |
| `(dashboard)/not-found.tsx` | 🔲 | 404 page. | — | `default` | unmatched |
| `(dashboard)/projects/page.tsx` | 🔲 | Project list. | Search + status filter + pagination via URL params; loading/empty/error states. | `default` | `/projects` |
| `(dashboard)/projects/[id]/page.tsx` | 🔲 | Project detail. | `useProject(id)` + member list + severity breakdown; `notFound()` on 404. | `default` | `/projects/:id` |
| `(dashboard)/findings/page.tsx` | 🔲 | Finding list. | Search + severity/status filter + pagination; row to detail. | `default` | `/findings` |
| `(dashboard)/findings/new/page.tsx` | 🔲 | Create finding. | `<FindingForm>`; guarded by `finding:create`. | `default` | `/findings/new` |
| `(dashboard)/findings/[id]/page.tsx` | 🔲 | Finding detail + inline edit. | `<FindingForm mode="edit">`; guarded by `finding:update`. | `default` | `/findings/:id` |

### 3.3 core/lib/api (🔲 all planned)

| Path | Status | Purpose | Responsibilities / notes |
|---|---|---|---|
| `lib/api/client.ts` | 🔲 | Single `fetch` wrapper. | `credentials:"include"`; `NEXT_PUBLIC_API_URL` base; JSON body; on **401** → single shared in-flight `refresh()` (`POST /auth/refresh`, credentials include) → retry once → else clear session + `router.replace('/login?reason=expired')`; on **403** → `toast` + invalidate/refetch `['auth','me']`; throws normalized `ApiError` (status, message, per-field `errors` from backend `errors` object). Never localStorage. |
| `lib/api/http-error.ts` | 🔲 | `ApiError` class. | Normalize backend error body `{ statusCode, message, error, errors? }` → `{ status, message, fieldErrors }`. |
| `lib/api/endpoints/auth.ts` | 🔲 | Auth calls. | `requestOtp(phone)`, `verifyOtp(phone, otp)`, `refresh()`, `logout()`, `me()`, `updateSummary(fullName)`. |
| `lib/api/endpoints/projects.ts` | 🔲 | Project calls. | `listProjects(params)`, `getProject(id)`, `listProjectMembers(id)`. |
| `lib/api/endpoints/findings.ts` | 🔲 | Finding calls. | `listFindings(params)`, `getFinding(id)`, `createFinding(body)`, `updateFinding(id, body)`, `deleteFinding(id)`. |
| `lib/api/endpoints/dashboard.ts` | 🔲 | Dashboard calls. | `getSummary()`, `getTrend(days)`, `getActivities(limit)`. |
| `lib/api/endpoints/index.ts` | 🔲 | Barrel re-export. | — |
| `lib/query/queryClient.ts` | 🔲 | TanStack `QueryClient` (default: `staleTime`, `retry` on network only). Shared ref for prefetching. | — |
| `lib/query/keys.ts` | 🔲 | Query-key factory. `auth.me`, `projects.all/list/params`, `projects.detail(id)`, `projects.members(id)`, `findings.*`, `dashboard.*`. | — |

### 3.4 core/hooks (existing + planned)

| Path | Status | Purpose | Notes |
|---|---|---|---|
| `hooks/useIsMobile.tsx` | ✅ | `"use client"`; `matchMedia` max-width 767px. | keep |
| `hooks/useUpdataQuery.tsx` | ✅ | Returns `(key,value)` updater that writes URL search params (drops value when `""`/`"all"`) and resets `page=1`. **Typo** in filename — rename to `use-update-query.ts` → `useUpdateQuery` in Phase 1. | keep, rename |
| `hooks/use-auth.ts` | 🔲 | Reads session (from query `['auth','me']` + Zustand mirror) + `isAuthenticated`, `isLoading`, `permissions`, `role`, `user`. | — |
| `hooks/use-can.ts` | 🔲 | `useCan(perm)` → boolean derived from `permissions`. | — |
| `hooks/use-projects.ts` | 🔲 | `useProjects(params)`; reads URL params; returns `{items,total,...}` + states. | — |
| `hooks/use-project.ts` | 🔲 | `useProject(id)` + `useProjectMembers(id)`. | — |
| `hooks/use-findings.ts` | 🔲 | `useFindings(params)`, `useFinding(id)`. | — |
| `hooks/use-dashboard.ts` | 🔲 | `useDashboardSummary()`, `useTrend(days)`, `useActivities(limit)`. | — |
| `hooks/use-mutations/findings.ts` | 🔲 | `useCreateFinding`, `useUpdateFinding`, `useDeleteFinding` (invalidate `findings.*`, `projects.detail`, `dashboard.*`, `activities`). | — |
| `hooks/use-mutations/auth.ts` | 🔲 | `useLogin`, `useLogout`, `useRequestOtp`, `useVerifyOtp`. | — |

### 3.5 core/store (Zustand)

| Path | Status | Purpose / responsibilities |
|---|---|---|
| `store/test.store.ts` | ✅ | Empty placeholder (0 lines). Delete. |
| `store/auth.store.ts` | 🔲 | **Client session mirror** (NOT source of truth — server state lives in TanStack Query `['auth','me']`): `{ user, permissions, role, status }` + `setSession()` / `clearSession()`. Read by `useCan`/`<Can>` without prop drilling. Re-populated on hard reload via `me()`. |
| `store/ui.store.ts` | 🔲 | `{ sidebarOpen, mobileNavOpen }` + setters; theme if added later. |

**Zustand justification:** TanStack Query owns *server* state (fetch/cache/invalidation). Zustand is used only for (a) a tiny in-memory mirror of the current user/permissions so `<Can>`/`useCan` work synchronously in any component without re-fetching, and (b) ephemeral client-only UI state (sidebar open/close) that must not round-trip. Both are UI/session concerns, not server data.

### 3.6 core/components

#### shadcn primitives (`components/shadcn/ui/*`) — ✅ all present

21 primitives, each a folder with `*.tsx` (some with `*.stories.tsx`): `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `input-otp`, `pagination`, `popover`, `progress`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `Textarea`, `tooltip`. Imported as `@/components/shadcn/ui/<name>/<name>` (or `@/shadcn/<name>`). **Do not edit** — regenerate via shadcn CLI.

#### custom/shared (`components/shared/*` — 🔲 planned, replacing unrelated `custom/`)

| Path | Status | Purpose / props / notes |
|---|---|---|
| `shared/severity-badge.tsx` | 🔲 | Maps `FindingSeverity` → colored `Badge`. props `{severity}`. a11y: color not the only signal (label text). |
| `shared/status-badge.tsx` | 🔲 | Maps `FindingStatus` / `ProjectStatus` → badge. |
| `shared/stat-card.tsx` | 🔲 | Dashboard stat. props `{label, value, icon?, trend?}`. |
| `shared/data-table.tsx` | 🔲 | Generic table w/ `@tanstack/react-table` OR simple columns + pagination footer. |
| `shared/search-filter-bar.tsx` | 🔲 | Debounced search + select filters + writes URL params. |
| `shared/state-view.tsx` | 🔲 | Loading/empty/error states (skeleton / empty copy / retry). Variants `loading|empty|error`. |
| `shared/can.tsx` | 🔲 | `<Can permission="finding:create">` or rol+e gate. Also `<RoleGate>` alias. |
| `shared/finding-form.tsx` | 🔲 | RHF+zod create/edit form (title, description, severity, projectId/status). |
| `shared/pagination-bar.tsx` | 🔲 | Page controls driven by URL `page`. |

#### existing custom (`components/custom/**`) — status notes

| Path | Status | Notes |
|---|---|---|
| `custom/ui/modal/Modal.tsx` + `modal.stories.tsx` | ✅ | Reusable dialog. Keep (fix RTL copy later). |
| `custom/ui/pagination/Pagination.tsx` | ✅ | URL-driven pagination, but assumes `{page,total}` shape — replace with `shared/pagination-bar`. |
| `custom/ui/search-input/SearchInput.tsx` | ✅ | Debounced URL search. Move/replace by `SearchFilterBar`. |
| `custom/ui/tagInput/TagInput.tsx` | ✅ | Generic tag input (likely unused for assessment; keep or drop). |
| `custom/ui/typography/Typography.tsx` | ✅ | `Big/H1..H4/P/Span/List/Lead/Large/Small/Muted/InputErrorMassage`. Keep (used widely). |
| `custom/ui/logo/Logo.tsx` | ⚠️ | Broken — references `/common/img/logo/kplogo.png` (missing). Replace. |
| `custom/ui/image/ImgNormalCustom.tsx` | ✅ | `next/image` wrapper w/ lazy/preload. Keep (drop unused `preload` if needed). |
| `custom/ui/ImageGallery/ImageGallery.tsx` | ⚠️ | **Broken** — imports missing `@/core/utils/getImageUrl` and uninstalled `react-icons/fi`. Unused → delete. |
| `custom/ui/wrapper/*` | 🟡 | `ClientLayout`/`DashboardSidebar`/`DashboardHeader`/`ContainerDashboard`/`PagesContainer`/`SectionLayout`. Rework `Dashboard*` into the assessment `components/layout/` shell (they currently read leftover nav + a fake logout). |
| `custom/blook/**` | 🟡 | `SideBar.tsx` (shadcn demo, hardcoded "Mahdi Bagheri"), `version-switcher.tsx` (shadcn demo), `Header.tsx` (**broken** import `../../ui/footer/header/TitleHeader`), `Footer.tsx` (stub). Replace with assessment shell. |

### 3.7 core/features (feature-based — recommended)

**Decision:** keep the existing `core/features/<domain>/` layout (already scaffolded for `auth`/`example`). Each domain owns its own `components/`, `hooks/`, `schemas/`, `types.ts`, and co-located `*.test.ts(x)` / `*.stories.tsx`. Shared UI goes to `components/`, data layer to `lib/api`, generic hooks to `hooks/`.

| Path | Status | Purpose |
|---|---|---|
| `features/auth/` | 🟡 | Scaffold only. Keep `getErrorMessage.ts` + test (move to `lib/api/http-error`), delete placeholder `test.ts` files. Add `components/login-form.tsx`, `components/otp-form.tsx`, `schemas.ts` (zod: phone, otp). |
| `features/example/` | ⚠️ | Placeholder — delete. |
| `features/dashboard/` | 🔲 | `components/summary-cards`, `components/severity-chart` (dynamic import Recharts), `components/status-breakdown`, `components/trend-chart`, `components/activities-feed`, `components/*.tsx`. |
| `features/projects/` | 🔲 | `components/project-table`, `components/project-filters`, `components/project-detail`, `components/members-list`, `schemas.ts`, `types.ts`. |
| `features/findings/` | 🔲 | `components/finding-table`, `components/finding-filters`, `components/finding-detail`, `components/finding-form` (or reuse `components/shared/finding-form`), `schemas.ts`, `types.ts`. |

### 3.8 core/types (🔲 new; existing legacy types in `assets/@types`)

| Path | Status | Purpose |
|---|---|---|
| `types/api.ts` | 🔲 | Envelope types: `PaginatedResult<T>` = `{items:T[]; total:number; page:number; limit:number; totalPages:number}` (matches backend, §6); `ApiError`. |
| `types/permission.ts` | 🔲 | `type Permission = 'dashboard:read' \| 'project:read' \| 'member:read' \| 'member:manage' \| 'finding:read' \| 'finding:create' \| 'finding:update' \| 'finding:delete' \| 'activity:read'` (mirror backend). |
| `types/role.ts` | 🔲 | `type Role = 'ADMIN' \| 'ANALYST' \| 'VIEWER'`. |
| `types/auth.ts` | 🔲 | `MeResponse` `{id, phone, name, role, orgId, orgName, permissions[]}`, `Session`. |
| `types/entities.ts` | 🔲 | `Project`, `ProjectDetail`, `ProjectMember`, `Finding`, `Activity`, enums `ProjectStatus`, `FindingSeverity`, `FindingStatus`. |
| `assets/@types/*` | ✅ | Legacy (`PaginationType.ts`, `sortBy.ts`, `Typography.ts`, `gender.enum.ts`). **`PaginationType` conflicts with real backend shape** — do not reuse for lists; keep only `Typography.ts`. |

### 3.9 core/mocks (🔲 MSW)

| Path | Status | Purpose |
|---|---|---|
| `mocks/handlers.ts` | 🔲 | REST handlers for `auth/*`, `projects*`, `findings*`, `dashboard/*`. |
| `mocks/server.ts` | 🔲 | `setupServer(...handlers)` for Vitest. |
| `mocks/browser.ts` | 🔲 | `setupWorker(...handlers)` for Storybook/browser preview. |
| `mocks/fixtures/*.ts` | 🔲 | Seeded users/permissions/projects/findings/activities (mirror backend seed). |

### 3.10 core/test & utils

| Path | Status | Purpose |
|---|---|---|
| `test/setup.ts` | ✅ | Imports `@testing-library/jest-dom/vitest`. Extend with MSW `afterEach` close + polyfills. |
| `test/utils.tsx` | 🔲 | `renderWithProviders(ui, options)` wrapping QueryClientProvider + MSW + router; re-exported RTL helpers. |
| `test/example.test.tsx` / `TestButton.tsx` | ✅ | Demo only — delete in Phase 6. |
| `utils/formatDate.tsx` (+`.test.ts`) | ✅ | Persian (`fa-IR`) date/time formatting. Replace with LTR/English (or keep if RTL decided). |
| `utils/formatZodErrors.ts` (+`.test.ts`) | ✅ | Extracts first zod error. **Uses `any`** — retype to `ZodError`. |
| `utils/getsortBy.ts` | 🟡 | E-commerce sort labels — delete. |
| `utils/shadcn/utils.ts` (+`.test.tsx`) | ✅ | `cn()` helper. Keep. |
| `lib/token/token.ts` | ✅ | `decodeJwtPayload`, `isTokenExpired` (client-side token expiry helper). Possibly unneeded (cookies httpOnly) — keep for tests only. |
| `lib/zod/zod.ts` | ✅ | Persian zod string/number/enum/phone builders. Retype messages or keep if RTL. |
| `lib/coockie/getAccess.ts` / `setCoockie.ts` | ⚠️ | **Incorrect vs backend** — cookie names `Token`/`accessToken`, but backend uses `X-ACCESS`/`X-REFRESH` (httpOnly). Client must not read/set these; delete and rely on `credentials:"include"`. |
| `lib/basic-link/BackendBasicLink.ts` | ✅ | `BASE_URL = process.env.NEXT_PUBLIC_BACK_URL`. Change to `NEXT_PUBLIC_API_URL` (§10). |
| `lib/revalidate/Revalidate.ts` | 🟡 | Unused server action — delete unless BFF adopted. |

---

## 4. Routing & access map

| Route | Purpose | Rendering | Required permission | Redirect if unauthorized | Data loaded | States handled |
|---|---|---|---|---|---|---|
| `/login` | phone → OTP → session | Server shell + client form | public | `/` if already authed | `POST /auth/request-otp`, `POST /auth/vrify-otp` | idle, sending, wrong code, locked, network error |
| `/` (dashboard) | KPIs + charts + activities | Server + client (charts) | `dashboard:read` (+`activity:read` for feed) | `/login?reason=...` if unauthenticated; 403 view if no perm | `GET /dashboard/summary`, `GET /dashboard/trend`, `GET /dashboard/activities` | loading, empty, error |
| `/projects` | list | Server shell + client table | `project:read` | `/login` or 403 | `GET /projects?page&limit&search&status` | loading, empty, error, pagination |
| `/projects/:id` | detail + members | Server (metadata) + client | `project:read` (+`member:read`) | 404 if not in org | `GET /projects/:id`, `GET /projects/:id/members` | loading, not-found, error |
| `/findings` | list | Server + client | `finding:read` | `/login` or 403 | `GET /findings?page&limit&search&severity&status&projectId` | loading, empty, error |
| `/findings/new` | create | client | `finding:create` | 403 | `POST /findings`, `GET /projects` (project picker) | form validation, submit, server error |
| `/findings/:id` | detail / edit | client | `finding:read` (update requires `finding:update`) | 403 | `GET /findings/:id`, `PATCH /findings/:id`, `DELETE /findings/:id` | loading, not-found, error |

**Redirect behavior** is centralized in `middleware.ts` (session existence) + `lib/api/client.ts` (401→ refresh → `/login?reason=expired`). Permission gating at route level is cosmetic; the backend returns 401/403/404 and the client surfaces the corresponding state.

---

## 5. Data flow & state management

### Where each kind of state lives

| State | Location | Rationale |
|---|---|---|
| Projects/findings/dashboard/session data | **TanStack Query** | Server data: cache, dedupe, invalidation, retry. |
| Auth session mirror (`user`, `permissions`, `role`) | Zustand `auth.store` (fed by `['auth','me']` query) | Synchronous `<Can>`/`useCan` access anywhere. |
| Sidebar/mobile-nav open state | Zustand `ui.store` | Ephemeral client-only. |
| List filters, search, pagination, sort | **URL search params** | Shareable, back/forward, SSR-friendly, survives refresh. Read via `useSearchParams`, written via `useUpdateQuery`. |
| Form field values | react-hook-form local state | Contained to form. |

### Query keys & invalidation

- Keys: `auth.me`; `projects.all(params)` / `projects.detail(id)` / `projects.members(id)`; `findings.list(params)` / `findings.detail(id)`; `dashboard.summary` / `dashboard.trend(days)` / `dashboard.activities(limit)`. Param objects are part of the key (URL params drive them).
- After `createFinding`/`updateFinding`/`deleteFinding`: invalidate `findings.list.*`, and related `projects.detail(id)` (finding counts), `dashboard.summary`, `dashboard.trend`, `dashboard.activities`.
- After login/logout: `queryClient.clear()` (or invalidate `auth.me` + redirect).
- On **403**: refetch `['auth','me']` (permissions may have changed) + toast.

### Auth/session lifecycle

```
[login] phone ──POST /auth/request-otp──> {message, remainingAttempts, code(dev)}
   └─ user enters OTP (dev: "00000")
        └─ POST /auth/vrify-otp {phone, otp}
             └─ backend sets httpOnly cookies: X-ACCESS (15m) + X-REFRESH (14d, path /auth/refresh)
                  └─ client: invalidate/refetch GET /auth/me
                       └─ {id, phone, name, role, orgId, orgName, permissions[]}
                            ├─ store permissions in Zustand auth.store
                            └─ UI renders from `permissions` (NOT role)
[request] any API call (credentials:"include", sent with X-ACCESS cookie)
   └─ 401 ──> single shared POST /auth/refresh (rotation) ── retry once
        ├─ ok ──> continue
        └─ fail ──> clear session → redirect /login?reason=expired
[logout] POST /auth/logout ──> backend clears cookies → clear query+store → redirect /login
```

### Permission flow

```
GET /auth/me  →  permissions: Permission[]
      │
      ▼
Zustand auth.store.permissions
      │
      ├── useCan('finding:create') ──> boolean
      └── <Can permission="finding:create">...</Can> / <RoleGate>
            │
            ▼
      show/hide controls (UX ONLY)
```

> **Backend is the real enforcement.** It derives `orgId` from the verified JWT and checks `ROLE_PERMISSIONS[role]` in `PermissionsGuard`. The frontend must never send `orgId` or trust `role`/client state for authorization. Cross-tenant reads return 404.

---

## 6. API contract used by the frontend

Base URL: `http://localhost:3001` (API `PORT=3001`). Swagger UI at `http://localhost:3001/docs`.

**List response shape (verified in `*.service.ts`)** — custom, NOT nestjs-paginate:
```jsonc
{ "items": [...], "total": 0, "page": 1, "limit": 10, "totalPages": 0 }
```
**Error shape (verified in `exception.filter.ts`):**
```jsonc
{ "statusCode": 401, "message": "...", "error": "Unauthorized", "errors": { "field": ["msg"] } } // errors only on validation
```
**Validation messages** come from `class-validator` (e.g. `"title must be at least 3 characters"`); field-level errors land in `body.errors` as `Record<string, string[]>`.

| # | Method | Path | Auth / Permission | Request | Response | Used by | Error cases |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/auth/request-otp` | public | `{ phone }` | `{ message, remainingAttempts, code? }` (dev includes `code`) | `features/auth` login | 429 (rate limit) |
| 2 | POST | `/auth/vrify-otp` ⚠ misspelled `vrify` | public | `{ phone, otp }` | `{ success:true }` + sets cookies `X-ACCESS`, `X-REFRESH` | login | 401 invalid/expired code, 404 user not found |
| 3 | POST | `/auth/refresh` | public (reads `X-REFRESH` cookie) | — | `{ success:true }` + rotated cookies | `lib/api/client.ts` | 401 invalid/expired session |
| 4 | POST | `/auth/logout` | authed | — | `{ success:true }` + clears cookies | logout | — |
| 5 | GET | `/auth/me` | authed | — | `{ id, phone, name, role, orgId, orgName, permissions[] }` | `useAuth` | 401 |
| 6 | PATCH | `/auth/summary-user` | authed | `{ fullName }` | `{ message }` | profile (optional) | 404 |
| 7 | GET | `/projects` | `project:read` | query `: page, limit, search?, status?` | `{ items:Project[], total, page, limit, totalPages }` | `useProjects` | 401/403 |
| 8 | GET | `/projects/:id` | `project:read` | — | `ProjectDetail` = `{...Project, findingsCount, severityBreakdown: Record<Severity,number>}` | `useProject` | 404 |
| 9 | GET | `/projects/:id/members` | `member:read` | — | `MemberResponse[]` = `{id,userId,projectId,roleInProject,joinedAt,name,phone,role}` | `useProjectMembers` | 404 |
| 10 | GET | `/findings` | `finding:read` | query `: page, limit, projectId?, severity?, status?, search?` | `{ items:Finding[], total, page, limit, totalPages }` | `useFindings` | 401/403 |
| 11 | GET | `/findings/:id` | `finding:read` | — | `Finding` | `useFinding` | 404 |
| 12 | POST | `/findings` | `finding:create` | `{ title, description?, severity, projectId }` | `Finding` (201) | `useCreateFinding` | 400 validation, 404 project not found |
| 13 | PATCH | `/findings/:id` | `finding:update` | `{ title?, description?, severity?, status? }` (≥1) | `Finding` | `useUpdateFinding` | 400 (empty body), 404 |
| 14 | DELETE | `/findings/:id` | `finding:delete` | — | `{ success:true }` | `useDeleteFinding` | 404 |
| 15 | GET | `/dashboard/summary` | `dashboard:read` | — | `{ projectsCount, findingsCount, severityBreakdown, projectStatusBreakdown }` | `useDashboardSummary` | 401/403 |
| 16 | GET | `/dashboard/trend` | `dashboard:read` | query `: days (1..90, default 30)` | `TrendPointDto[]` = `[{date, count}]` | `useTrend` | 401/403 |
| 17 | GET | `/dashboard/activities` | `activity:read` | query `: limit (1..50, default 10)` | `ActivityDto[]` = `[{id,userId,action,targetType,targetId,targetName,createdAt}]` | `useActivities` | 401/403 |

### Enums (string values) — mirror exactly

| Enum | Values |
|---|---|
| `Role` | `ADMIN`, `ANALYST`, `VIEWER` |
| `FindingSeverity` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO` |
| `FindingStatus` | `OPEN`, `IN_REVIEW`, `RESOLVED`, `ACCEPTED` |
| `ProjectStatus` | `ACTIVE`, `IN_PROGRESS`, `COMPLETED`, `ARCHIVED` |

### Permissions matrix (verified `ROLE_PERMISSIONS`)

| Permission | VIEWER | ANALYST | ADMIN |
|---|:-:|:-:|:-:|
| `dashboard:read`, `project:read`, `member:read`, `activity:read`, `finding:read` | ✅ | ✅ | ✅ |
| `finding:create`, `finding:update` | ❌ | ✅ | ✅ |
| `finding:delete`, `member:manage` | ❌ | ❌ | ✅ |

### Seeded login phones (dev OTP = `00000`)

| Org | ADMIN | ANALYST | VIEWER |
|---|---|---|---|
| Org A | 09911110001 | 09911110002 | 09911110003 |
| Org B | 09922220001 | 09922220002 | 09922220003 |
| Org C | 09933330001 | 09933330002 | 09933330003 |

---

## 7. Reusable components catalog

Existing primitives (shadcn) are listed in §3.6. Below are the **assessment domain components** to build in `components/shared/` (≥5 required, with Storybook + tests).

### `SeverityBadge`
- **Purpose:** colored badge for `FindingSeverity`.
- **Props:** `severity: FindingSeverity` (req); `className?: string`.
- **States/variants:** CRITICAL/HIGH/MEDIUM/LOW/INFO → distinct colors.
- **A11y:** text label present (color never the only signal).
- **Used by:** findings list/detail, dashboard breakdown, project detail.
- **Story/tests:** ✅ planned (`severity-badge.stories.tsx`, `severity-badge.test.tsx` — renders label per severity).

### `StatusBadge`
- **Props:** `status: FindingStatus | ProjectStatus` (req).
- **States:** all enum values.
- **A11y:** as SeverityBadge.
- **Used by:** findings list/detail, projects list.
- **Story/tests:** ✅ planned.

### `StatCard`
- **Props:** `label: string` (req), `value: number | string` (req), `icon?: ReactNode`, `variant?: "default"|"accent"`.
- **States:** default/accent; loading skeleton via `isLoading?`.
- **A11y:** semantic `<article>`/`<dl>`.
- **Used by:** dashboard.
- **Story/tests:** ✅ planned.

### `StateView` (loading/empty/error)
- **Props:** `state: "loading"|"empty"|"error"` (req), `emptyTitle?`, `emptyMessage?`, `errorMessage?`, `onRetry?`, `children`.
- **States:** 3 variants.
- **A11y:** `role="status"` / `role="alert"` for error; focus on retry button.
- **Used by:** every list/detail page.
- **Story/tests:** ✅ planned (`state-view.test.tsx` — each variant; retry callback fired).

### `SearchFilterBar`
- **Props:** `searchPlaceholder?`, `filters: FilterDef[]`, `searchParam`/writes URL.
- **States:** initial (from URL), empty.
- **A11y:** labeled input; select labels.
- **Used by:** projects list, findings list.
- **Story/tests:** ✅ planned (debounced writes to URL; filter change resets page).

### `DataTable`
- **Props:** `columns: ColumnDef<T>[]`, `rows: T[]`, `getRowHref?: (row)=>string`, `onRowClick?`, `ariaLabel`.
- **States:** loading/empty (delegates to `StateView`).
- **A11y:** real `<table>`, `<th scope>`, keyboard reachable rows if clickable.
- **Used by:** projects/findings lists, members.
- **Story/tests:** ✅ planned (renders columns; empty state; row click).

### `Can` / `useCan`
- **Props:** `useCan(permission: Permission): boolean`; `<Can permission="..." fallback={null}>`.
- **Notes:** reads Zustand `auth.store.permissions`. Never a security boundary.
- **Used by:** role-aware UI everywhere.
- **Story/tests:** ✅ planned (`can.test.tsx` — shows/hides by permission; `fallback`).

### `FindingForm`
- **Props:** `mode: "create"|"edit"` (req), `defaultValues?: FindingInput`, `projects: {id,name}[]`, `onSubmit(values)`, `isSubmitting`.
- **Validation:** zod (title 3–200, description ≤5000, severity enum, projectId uuid; edit adds status).
- **States:** idle, submitting, per-field errors.
- **A11y:** labels, `aria-invalid`, `role="alert"` error text, semantic form.
- **Used by:** `/findings/new`, `/findings/:id` edit.
- **Story/tests:** ✅ planned (validation + submit; server field errors mapped).

### `PaginationBar`
- **Props:** `page`, `totalPages`, `totalItems`, `limit`.
- **States:** first/middle/last, disabled prev/next.
- **A11y:** nav landmark, `aria-label`s, current page announced.
- **Used by:** projects/findings lists.
- **Story/tests:** ✅ planned.

---

## 8. Conventions & rules for future agents

### Naming & placement
- Folders/components: `kebab-case`; components PascalCase. Files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `middleware.ts` are reserved App Router names.
- Feature code in `src/core/features/<domain>/`; cross-cutting UI in `src/core/components/<shared|shadcn>`; API in `src/core/lib/api`; generic hooks in `src/core/hooks`; stores in `src/core/store`; shared types in `src/core/types`; MSW in `src/core/mocks`; global test utilities in `src/core/test`.
- Stories co-located as `*.stories.tsx`; tests co-located as `*.test.ts(x)` (unit) — except integration/route tests in `src/core/test/`.
- No leftover `test.ts` placeholder files.

### Imports
- Use aliases: `@/core/...`, `@/components/...`, `@/shadcn/...`, `@/...`. No long relative paths across directories. No barrel files that create circular imports (keep `index.ts` barrels shallow).

### Server vs client
- Default to **server components**. Add `"use client"` only when a component uses hooks, event handlers, browser APIs, or context (forms, toggles, charts, tables with client state).
- Mark client subtrees as small as possible; pass server-fetched data down as props.
- `middleware.ts` runs on the edge/runtime — keep it dependency-light.

### TypeScript
- `strict: true`. **No `any`** (fix existing `formatZodErrors.ts` / `getErrorMessage.ts`). Use `unknown` + narrowing. Prefer union/enum types imported from `types/` over string literals.

### Error/loading/empty standard
- Every data view uses `StateView` for `loading | empty | error`. Errors normalize through `apiError` (per-field + message). Global toasts via `sonner`; inline field errors via `InputErrorMassage`.

### Forms
- `react-hook-form` + `zod` (`@hookform/resolvers`). Schemas in each `features/<domain>/schemas.ts`. Map backend `errors` object to field errors. Submit buttons show loading + disabled state.

### Styling
- Tailwind v4 utility classes + existing `@theme` tokens (`bg-primary`, `text-muted-foreground`, `border-border`, etc.). shadcn primitives for structural UI. **No inline `style={}`. No custom CSS files** (extend `globals.css` `@theme` only if a new token is genuinely needed).

### Accessibility checklist (per component/page)
- Semantic HTML (`header/nav/main/table/dl/form`), single `h1` per page, visible focus states, keyboard operability (forms, tables, dialogs via Radix), `aria-label` on icon-only buttons, `aria-invalid`/`aria-describedby` on invalid fields, `role="alert"`/`role="status"` for messages, color + text (never color-only), `prefers-reduced-motion` respect.

### Performance rules (from `performance-optimization` SKILL)
- No unnecessary `"use client"`; keep initial bundle small. **Dynamic-import the chart component** (`next/dynamic` + `ssr:false`) so Recharts doesn't bloat the main bundle.
- Memoize/`React.memo`/`useMemo` **only when justified** (profiled re-render or expensive compute) — avoid blanket memoization.
- Avoid request waterfalls: fetch dashboard summary/trend/activities in parallel (`Promise.all` via TanStack Query); don't block shell on slow queries.
- Paginate all lists (backend enforces `page`/`limit`). Debounce search (`use-debounce`).
- Use `next/image` (existing `ImgNormalCustom`) with dimensions; `loading="lazy"` below the fold.
- Core Web Vitals targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; initial JS <200KB gzip.

### Security rules
- **Never store tokens in `localStorage`/`sessionStorage`.** Cookies are httpOnly; only use `credentials:"include"`.
- **Never trust client role/permission for authorization** — backend enforces. Frontend gating is UX only.
- **Never send `orgId` from the client** (backend derives it from the JWT).
- `403` → refetch `/auth/me` (permissions may have drifted) + toast; `401` → single shared refresh → retry once → logout.
- No secrets in code; API base URL via `NEXT_PUBLIC_API_URL`.

### Definition of Done (any new page/component)
- [ ] Renders without `any`; strict types pass.
- [ ] Server/client split correct; minimal client tree.
- [ ] Loading/empty/error states handled via `StateView`/skeletons.
- [ ] Forms validated with zod + RHF; backend field errors mapped.
- [ ] A11y: semantic HTML, keyboard, focus, aria, color+text.
- [ ] Responsive (mobile nav, table → responsive).
- [ ] Storybook story (main component) with `autodocs` + a11y addon clean.
- [ ] ≥1 focused test (behavioral, RTL) where applicable.
- [ ] No new deps without justification; no dead/placeholder files.
- [ ] `pnpm lint` and `pnpm test` green.

---

## 9. Testing & Storybook plan

Rendering = RTL `render`; Interaction = `userEvent`; Form validation, API error, Loading, Role-based UI, Session expiration, Filtering, Component behavior — covered below.

### Tests (≥12 planned)

| # | File | Category | Asserts |
|---|---|---|---|
| 1 | `features/auth/login-form.test.tsx` | Form validation | phone required/format; empty submit shows field error |
| 2 | `features/auth/login-form.test.tsx` | Session/Create or edit | successful verify-otp → session set → redirect `/` |
| 3 | `features/auth/login-form.test.tsx` | API error | invalid OTP → error message shown; field mapping |
| 4 | `components/shared/severity-badge.test.tsx` | Rendering | correct label per severity; role/class |
| 5 | `components/shared/state-view.test.tsx` | Component behavior | loading/empty/error variants; retry callback fires |
| 6 | `components/shared/can.test.tsx` | Role-based UI | shows child with permission; fallback without |
| 7 | `components/shared/search-filter-bar.test.tsx` | Filtering | debounced URL write; filter change resets page |
| 8 | `components/shared/data-table.test.tsx` | Component behavior | columns render; empty state; row click |
| 9 | `features/projects/project-table.test.tsx` | Filtering / Loading | renders rows; empty state; loading skeleton |
| 10 | `features/findings/finding-form.test.tsx` | Form validation | title length, severity enum, projectId required; server field errors mapped |
| 11 | `lib/api/client.test.ts` | Session expiration | 401 → refresh called → retry succeeds; refresh fail → redirect `/login?reason=expired` |
| 12 | `lib/api/client.test.ts` | API error | 403 → /auth/me refetch + normalized ApiError; 422 field errors |
| 13 | `features/dashboard/summary.test.tsx` | Rendering / Role-based | adds up severities; hides create button for VIEWER |
| 14 | `hooks/use-auth.test.tsx` | Role-based UI / Session | session mirror populated from `/auth/me` permissions |

### Storybook stories (states covered)

| Component story | States |
|---|---|
| `severity-badge.stories` | CRITICAL, HIGH, MEDIUM, LOW, INFO |
| `status-badge.stories` | OPEN, IN_REVIEW, RESOLVED, ACCEPTED; ACTIVE..ARCHIVED |
| `stat-card.stories` | default, accent, loading |
| `state-view.stories` | loading, empty, error |
| `search-filter-bar.stories` | empty, pre-filled (from URL) |
| `data-table.stories` | populated, empty, clickable rows |
| `can.stories` | allowed, denied, with fallback |
| `pagination-bar.stories` | first, middle, last, single page |
| `finding-form.stories` | create (empty), edit (pre-filled), validation errors |

MSW `browser.ts` provided to Storybook `preview.tsx` so stories can render real API-backed components.

---

## 10. Scripts & environment

### package.json scripts (existing ✅)

```
dev           next dev
build         next build
start         next start
lint          eslint
test          vitest
storybook     storybook dev -p 6006
build-storybook storybook build
```

**Planned additions (🔲):** `test:watch` (`vitest --watch`), `test:run` (`vitest run`), `typecheck` (`tsc --noEmit`), `test:coverage` (`vitest run --coverage`).

### Required env vars (`.env.example` outline)

```bash
# apps/web/.env.example  (🔲 normalize to this)
NEXT_PUBLIC_API_URL=http://localhost:3001   # API base (NestJS PORT=3001)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠ **Reconcile naming (see §12):** the current `apps/web/.env` uses `NEXT_PUBLIC_BACK_URL=http://localhost:3000` (wrong port, wrong name). Root `.env.example` uses `NEXT_PUBLIC_API_URL=http://localhost:3001`. Standardize on `NEXT_PUBLIC_API_URL`.

### Run web + api together

```bash
# deps (from repo root)
pnpm install
# infra (Postgres 15432, Redis 6379)
docker compose -f docker/compose.yml up -d          # (confirm compose filename)
# seed backend
pnpm --filter api run seed
# run both (turbo)
pnpm dev            # api:3001 + web:3000
# or individually
pnpm --filter api run dev
pnpm --filter web run dev
```

---

## 11. Suggested build order

### Phase 1 — Setup + auth
- `lib/api/client.ts`, `lib/api/http-error.ts`, `lib/query/queryClient.ts`, `lib/query/keys.ts`, `lib/api/endpoints/auth.ts`.
- Install `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`; add root `QueryProvider`.
- `store/auth.store.ts`, `hooks/use-auth.ts`, `hooks/use-can.ts`, `components/shared/can.tsx`.
- `middleware.ts`, `(auth)/layout.tsx`, `(auth)/login/page.tsx`, `features/auth/*`.
- Standardize env (`NEXT_PUBLIC_API_URL`); delete broken cookie helpers/token leftovers.

### Phase 2 — Layout + dashboard
- `(dashboard)/layout.tsx` (AppShell), `components/layout/sidebar.tsx`, `header.tsx`, mobile nav (replace `custom/blook` + `wrapper/Dashboard*`).
- `lib/api/endpoints/dashboard.ts`, `hooks/use-dashboard.ts`, `features/dashboard/*` (StatCard, severity chart via `next/dynamic`, trend, activities).
- `(dashboard)/page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.

### Phase 3 — Projects
- `types/entities.ts`, `types/api.ts`, `lib/api/endpoints/projects.ts`, `hooks/use-projects.ts`/`use-project.ts`.
- `features/projects/*`, `components/shared/data-table.tsx`, `search-filter-bar.tsx`, `pagination-bar.tsx`, `state-view.tsx`.
- `(dashboard)/projects/page.tsx`, `projects/[id]/page.tsx`.

### Phase 4 — Findings
- `lib/api/endpoints/findings.ts`, `hooks/use-findings.ts`/`use-mutations`.
- `features/findings/*`, `components/shared/severity-badge.tsx`, `status-badge.tsx`, `finding-form.tsx`.
- `(dashboard)/findings/page.tsx`, `new/page.tsx`, `[id]/page.tsx`.

### Phase 5 — Shared components + Storybook
- Promote/finalize the `components/shared/*` catalog (§7); write all `*.stories.tsx`; wire MSW `browser.ts` into Storybook; verify a11y addon clean.

### Phase 6 — Tests + MSW
- Install `msw`; build `mocks/handlers.ts` + fixtures; `test/utils.tsx` (`renderWithProviders`); write the §9 test list; delete `test/example.test.tsx`, `TestButton.tsx`, `features/example/`, dead `test.ts` files.

### Phase 7 — A11y / responsive / README
- Keyboard + screen-reader pass; mobile responsive tables/nav; update `README.md` (run instructions, seeded users, OTP); final `pnpm lint` + `pnpm test` + `pnpm build` green.

---

## 12. Open questions & risks

1. **Env var name/port mismatch.** `apps/web/.env` uses `NEXT_PUBLIC_BACK_URL=http://localhost:3000` (its own port), but the API listens on **3001** and the root `.env.example` declares `NEXT_PUBLIC_API_URL=http://localhost:3001`.
   → **Recommendation:** standardize on `NEXT_PUBLIC_API_URL=http://localhost:3001` in `apps/web/.env.example` and update `lib/basic-link` accordingly.

2. **Cookie-name drift (frontend leftovers).** `setCoockie.ts` writes `accessToken`; `getAccess.ts` reads `Token`; backend sets **`X-ACCESS` / `X-REFRESH`** (httpOnly, `X-REFRESH` scoped to path `/auth/refresh`). The frontend must not read/name cookies at all — it only sends `credentials:"include"`.
   → **Recommendation:** delete `lib/coockie/*`, `lib/token/*` client helpers; rely on the browser + `client.ts` refresh.

3. **Language/direction.** The committed scaffold is **RTL Persian** (`lang="fa" dir="rtl"`, Persian validation strings, `fa-IR` dates) and carries a Persian e-commerce/panel (navItems `/panel/admin/order`, missing logo/broken imports). The assessment spec is written in English.
   → **Recommendation:** build the assessment UI **LTR English** (fresh copy), retire the Persian leftovers. Confirm before Phase 1, since it affects fonts, date formatting, and all copy.

4. **Pagination contract mismatch.** Frontend `PaginationType` expects `{data, meta{itemsPerPage,totalItems,totalPages,currentPage}, links}`; the **real backend** returns `{items, total, page, limit, totalPages}`. Do not reuse `PaginationType`.
   → **Recommendation:** type lists against `PaginatedResult<T>` = `{items,total,page,limit,totalPages}` (§3.8).

5. **`/auth/vrify-otp` is misspelled** on the backend. The frontend must call the literal path `POST /auth/vrify-otp` (not `verify-otp`). No backend change allowed.

6. **Missing mandated dependencies.** `@tanstack/react-query`, `react-hook-form`, `recharts`, `msw` are required/suggested but not installed. Install in Phases 1/6 (see §10).

7. **Broken/dead files to remove** (confirmed broken imports or unrelated): `custom/blook/header/Header.tsx` (imports non-existent `TitleHeader`), `custom/ui/ImageGallery/ImageGallery.tsx` (missing `@/core/utils/getImageUrl` + uninstalled `react-icons/fi`), `custom/ui/logo/Logo.tsx` (missing asset), `custom/blook/sidebar/SideBar.tsx` + `version-switcher.tsx` (shadcn demo with hardcoded user), `assets/mock/navItems.ts`, `assets/@types/sortBy.ts` + `getsortBy.ts`, `features/example/**`, all placeholder `test.ts`. Confirm removal with owner before deleting per dead-code hygiene. `src/core/features/auth/test/getErrorMessage.ts` duplicates logic destined for `lib/api/http-error.ts`.

8. **List/member shape has no pagination link metadata** (backend returns plain arrays and custom pagination). The frontend pagination must compute from `page/totalPages`, not `links`.

9. **`components.json` css path** is `app/globals.css` but the file lives at `src/app/globals.css`. Fix before using the shadcn CLI to add components (or the CLI will target a wrong path).

10. **`summary-user` (PATCH) is the only "profile" endpoint**; there is no org list endpoint — the UI renders the single org from `/auth/me` (`orgName`), which is acceptable for the 3-org demo but worth noting for any multi-org switcher ambitions.

---

## Appendix A — Self-review notes (verification)

- Every ✅ path above was verified against the repo during inspection (config, `src/app`, `src/core/**`, backend `apps/api/src/**`).
- Endpoint table derived from `auth.controller.ts`, `projects.controller.ts`, `findings.controller.ts`, `dashboard.controller.ts` and their `dto`/`service` files; response shapes confirmed in `projects.service.ts` / `findings.service.ts` / `dashboard.service.ts` / `auth.service.ts` / `exception.filter.ts`.
- Permission matrix confirmed from `permissions.constants.ts` `ROLE_PERMISSIONS`; enums from `role-app.enum.ts`, `finding-*.enum.ts`, `project-status.enum.ts`.
- Seed data (orgs/users/phones) confirmed from `seed/seed.ts` + `apps/api/README.md`.
