# Buntalk Storefront

The Buntalk online store, built with Next.js (App Router), React and TypeScript. Product, price, stock and order data come from the ERP backend.

## Requirements

- Node.js 20.9 or newer (24 LTS recommended)
- npm (the lockfile is `package-lock.json`; don't mix in yarn or pnpm)

## Getting started

```bash
npm install                 # also installs the Git hooks (via the "prepare" script)
cp .env.example .env.local  # then fill in the values
npm run dev                 # http://localhost:3000
```

## Scripts

| Command                | What it does                                       |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Start the dev server (Turbopack)                   |
| `npm run build`        | Production build                                   |
| `npm run start`        | Serve the production build                         |
| `npm run lint`         | ESLint                                             |
| `npm run typecheck`    | TypeScript check (`tsc --noEmit`)                  |
| `npm run format`       | Format everything with Prettier                    |
| `npm run format:check` | Check formatting without writing                   |
| `npm run check`        | Lint + typecheck + format check (what CI will run) |

## Environment

All variables are documented in [`.env.example`](.env.example). Copy it to `.env.local` for local work; staging and production values are set in the hosting/CI environment and are never committed.

| Variable               | Scope  | Purpose                                       |
| ---------------------- | ------ | --------------------------------------------- |
| `NEXT_PUBLIC_APP_ENV`  | public | `local`, `staging` or `production`            |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical site URL (metadata, absolute links) |
| `ERP_API_BASE_URL`     | server | ERP API base URL                              |
| `ERP_API_KEY`          | server | ERP API key, never exposed to the browser     |

Env vars are validated with Zod:

- `lib/env.ts` holds public vars and can be imported anywhere.
- `lib/env.server.ts` holds server secrets. It imports `server-only`, so importing it from a Client Component fails the build. It's validated the first time it's used, so pages that don't call the ERP still build without it.

## Project structure

```
app/              Routes, layouts and route handlers (App Router)
  layout.tsx      Root layout: fonts, metadata, <Providers>
  providers.tsx   Client-side providers (TanStack Query)
components/
  ui/             Generic, reusable UI primitives (buttons, inputs, …)
  layout/         Site chrome: header, footer, navigation
features/         Feature modules, one folder per domain (cart, catalog, checkout, …)
  cart/           Cart store (Zustand) and cart-specific code
lib/
  erp/            ERP API client (server only)
  auth/           Authentication and session handling
  utils/          Small shared helpers
  env.ts          Public env (validated)
  env.server.ts   Server-only env (validated)
  query-client.ts TanStack Query client factory
styles/           Global CSS and Tailwind setup
public/           Static assets served from /
```

### Conventions

- **Imports**: use the `@/` alias (`@/lib/erp`, `@/features/cart`) instead of long relative paths.
- **Features**: code used by one domain lives in `features/<domain>/` and is exported through that folder's `index.ts`. Move it to `components/` or `lib/` only once a second feature needs it.
- **Server vs client**: components are Server Components by default. Add `"use client"` only where you need state, effects or browser APIs, and keep it as far down the tree as you can.
- **ERP access** goes only through `lib/erp` and only on the server (Server Components, Server Actions, route handlers). The browser never calls the ERP directly.
- **Naming**: component files use `PascalCase.tsx`; everything else uses `kebab-case.ts`.

## State and data fetching

| Kind of data                                    | Approach                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Server data for a page (products, categories)   | Fetch in Server Components through `lib/erp`, using Next.js caching                             |
| Server data that changes on the client          | TanStack Query (`@tanstack/react-query`). The provider is in `app/providers.tsx`                |
| Mutations (add to cart on the server, checkout) | Server Actions, or route handlers called through TanStack Query mutations                       |
| Client-only state (cart, UI toggles)            | Zustand stores in the owning feature, e.g. `features/cart/store.ts` (persisted to localStorage) |

## Code quality

- **ESLint** uses `eslint-config-next` (Core Web Vitals + TypeScript), with `eslint-config-prettier` so it doesn't conflict with Prettier.
- **Prettier** includes the Tailwind class-sorting plugin. Settings are in `.prettierrc.json`.
- **Husky pre-commit hook** runs `lint-staged` (ESLint `--fix` and Prettier on staged files) and then `npm run typecheck`. A commit is blocked if either fails.

## Styling

Tailwind CSS v4 is set up in `styles/globals.css`. Design tokens, typography and brand styles are defined in BUN-152.
