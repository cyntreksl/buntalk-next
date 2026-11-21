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
| `REVALIDATE_SECRET`    | server | Secret the ERP sends to `/api/revalidate`     |

Env vars are validated with Zod:

- `lib/env.ts` holds public vars and can be imported anywhere.
- `lib/env.server.ts` holds server secrets. It imports `server-only`, so importing it from a Client Component fails the build. It's validated the first time it's used, so pages that don't call the ERP still build without it.

**Sample catalog:** when `NEXT_PUBLIC_APP_ENV=local` and `ERP_API_BASE_URL` or `ERP_API_KEY` is empty, catalog pages use built-in sample data (`lib/erp/sample-catalog.ts`), so the site runs locally without ERP access. Staging and production never use it: without ERP settings, catalog pages fail instead of showing sample data.

## Project structure

```
app/              Routes, layouts and route handlers (App Router)
  layout.tsx      Root layout: fonts, metadata, <Providers>
  providers.tsx   Client-side providers (TanStack Query)
  (catalog)/      Static + ISR pages: home, category/[slug], product/[slug]
  (private)/      Per-user pages, never cached: cart, checkout, account
  search/         Search results (dynamic)
  api/revalidate/ On-demand revalidation webhook for the ERP
components/
  ui/             Generic, reusable UI primitives (buttons, inputs, …)
  layout/         Site chrome: header, footer, navigation
features/         Feature modules, one folder per domain (cart, catalog, checkout, …)
  cart/           Cart store (Zustand) and cart components
  catalog/        Product cards and grids
lib/
  erp/            ERP API client and cached catalog reads (server only)
  auth/           Authentication and session handling
  utils/          Small shared helpers
  cache-tags.ts   Cache tag names used for on-demand revalidation
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

## Rendering strategy

The project uses Next.js [Cache Components](https://nextjs.org/docs/app/getting-started/caching) (`cacheComponents` and `partialPrefetching` in `next.config.ts`). Caching is opt-in: data is cached only where it's wrapped in `'use cache'` with a `cacheLife` profile. Everything else renders per request.

### Rendering mode per route

| Route              | Mode                    | Refresh                                     | Notes                                                                                              |
| ------------------ | ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/`                | Static + ISR            | every 15 min, or on demand                  | Categories and featured products                                                                   |
| `/category/[slug]` | Static + ISR            | every 15 min, or on demand                  | All categories prerendered at build time                                                           |
| `/product/[slug]`  | Static + ISR            | every 15 min, or on demand                  | Featured products prerendered at build time. Others are built on their first visit, then cached    |
| `/search`          | Dynamic                 | per request; results per query cached 5 min | Depends on `?q=`. Not indexed by search engines                                                    |
| `/cart`            | Client-side             | n/a                                         | Cart lives in the visitor's browser (localStorage). The server page holds no user data             |
| `/checkout`        | Dynamic                 | per request                                 | Reads the session cookie. Prices and stock are re-checked against the ERP when the order is placed |
| `/account`         | Dynamic                 | per request                                 | Reads the session cookie                                                                           |
| `/api/revalidate`  | Dynamic (route handler) | n/a                                         | On-demand revalidation webhook, see below                                                          |

`npm run build` prints this table as well. `○` means static, `◐` means a static shell with per-request parts, and `ƒ` means fully dynamic.

### Catalog pages (`app/(catalog)/`)

- Data comes from the cached reads in `lib/erp/catalog.ts`. Each one is a `'use cache'` function with the `catalog` cache profile and cache tags.
- The `(catalog)` layout sets `ensureStatic = 'navigation'`:
  - The full HTML is always produced on the server, so the content shows with JavaScript disabled and search engines see it.
  - A product that wasn't prerendered at build time waits for its full page on the first visit (no loading placeholder). After that it's served from the cache.
  - The build fails if a catalog page ever reads cookies, headers, `searchParams` or uncached data. That keeps per-user data out of these shared pages.
- Interactive parts, like **Add to cart**, are small client components. The cached HTML is the same for every visitor.
- Product links use `<Link prefetch={true}>` so each product's own page is prefetched, not just the shared App Shell.

### Cache profiles (`cacheLife` in `next.config.ts`)

| Profile   | Used by                       | `stale` | `revalidate` | `expire` |
| --------- | ----------------------------- | ------- | ------------ | -------- |
| `catalog` | Home, category, product pages | 5 min   | 15 min       | 1 day    |
| `search`  | Search results per query      | 1 min   | 5 min        | 1 hour   |

- **stale**: how long the browser reuses a page without asking the server.
- **revalidate**: once this has passed, the next visitor still gets the cached page and a fresh copy is built in the background.
- **expire**: if nobody visits for this long, the next visitor waits for a fresh copy.

A page refreshes as often as the shortest-lived data it shows. To change a page type's refresh time, change its profile in `next.config.ts`.

### On-demand revalidation

When data changes in the ERP (price update, new product, edited description), the ERP calls the webhook so the site updates right away instead of waiting up to 15 minutes:

```http
POST /api/revalidate
Authorization: Bearer <REVALIDATE_SECRET>
Content-Type: application/json

{ "type": "product", "slug": "<product-slug>" }
```

| `type`     | Body needs | Refreshes                                                           |
| ---------- | ---------- | ------------------------------------------------------------------- |
| `product`  | `slug`     | That product page, plus every product list (category, home, search) |
| `category` | `slug`     | That category page, plus the category list                          |
| `home`     | —          | Home page                                                           |
| `all`      | —          | The whole catalog                                                   |

Responses:

- `200 {"revalidated": [...tags]}` on success
- `401` when the secret is wrong
- `400` when the body is invalid
- `503` when `REVALIDATE_SECRET` isn't set

Pages keep serving the old version until the new one is ready, so visitors never wait. Tag names are in `lib/cache-tags.ts`. When adding a cached read, give it the matching tags.

### Per-user pages (`app/(private)/`)

Cart, checkout and account pages are never cached for other users:

- Per-user server data (the session, orders) is read with `cookies()` inside `<Suspense>`, which makes that part render on every request.
- The `(private)` layout sets `ensureStatic = false`, so these routes can never be forced static. It also sets `robots: noindex`.
- `next.config.ts` sends `Cache-Control: private, no-store, max-age=0` for `/cart`, `/checkout` and `/account`, so browsers, proxies and CDNs never store them.

### Adding a page

1. Is it the same for every visitor? Put it in `app/(catalog)/`, read data through cached functions in `lib/erp`, and add `generateStaticParams` for dynamic routes.
2. Does it show per-user data? Put it in `app/(private)/` (and add its path to `PRIVATE_PATHS` in `next.config.ts`). Read the session inside `<Suspense>`.
3. Does it depend on the query string? Read `searchParams` inside `<Suspense>`, as in `app/search/page.tsx`.

## Code quality

- **ESLint** uses `eslint-config-next` (Core Web Vitals + TypeScript), with `eslint-config-prettier` so it doesn't conflict with Prettier.
- **Prettier** includes the Tailwind class-sorting plugin. Settings are in `.prettierrc.json`.
- **Husky pre-commit hook** runs `lint-staged` (ESLint `--fix` and Prettier on staged files) and then `npm run typecheck`. A commit is blocked if either fails.

## Styling

Tailwind CSS v4 is set up in `styles/globals.css`. Design tokens, typography and brand styles are defined in BUN-152.
