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

| Variable               | Scope  | Purpose                                                 |
| ---------------------- | ------ | ------------------------------------------------------- |
| `NEXT_PUBLIC_APP_ENV`  | public | `local`, `staging` or `production`                      |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical site URL (metadata, absolute links)           |
| `ERP_API_BASE_URL`     | server | ERP API base URL                                        |
| `ERP_API_KEY`          | server | ERP storefront credential, never exposed to the browser |
| `ERP_TENANT`           | server | Buntalk business (tenant) ID in the ERP                 |
| `ERP_TIMEOUT_MS`       | server | Optional ERP request time limit (default 8000)          |
| `ERP_WEBHOOK_SECRET`   | server | Secret the ERP signs its webhooks with (HMAC-SHA256)    |

Env vars are validated with Zod:

- `lib/env.ts` holds public vars and can be imported anywhere.
- `lib/env.server.ts` holds server secrets. It imports `server-only`, so importing it from a Client Component fails the build. It's validated the first time it's used, so pages that don't call the ERP still build without it.

**Sample catalog:** when `NEXT_PUBLIC_APP_ENV=local` and `ERP_API_BASE_URL` or `ERP_API_KEY` is empty, catalog pages use built-in sample data (`lib/erp/sample-catalog.ts`), so the site runs locally without ERP access. Staging and production never use it: without ERP settings, catalog pages fail instead of showing sample data.

## Project structure

```
app/              Routes, layouts and route handlers (App Router)
  layout.tsx      Root layout: fonts, metadata, <Providers>
  providers.tsx   Client-side providers (TanStack Query, toasts)
  not-found.tsx   404 page
  (site)/         Pages with the full site header and footer
    (catalog)/    Static + ISR pages: home, category/[slug], product/[slug]
    (private)/    Per-user pages, never cached: cart, account/*
    (content)/    Policy, help, about, contact and outlet pages
    search/       Search results (dynamic)
    style-guide/  Design system and component reference
  (checkout)/     Checkout, with the minimal checkout header
  api/revalidate/ On-demand revalidation webhook for the ERP
  api/session/    "Is the visitor signed in?" for the header account menu
components/
  ui/             Shared UI component library (see "UI components" below)
  layout/         Page shell, footer, Container, PageHeader
    header/       Site header: mega-menu, mobile drawer, search, cart, account menu
    footer/       Site footer: link groups, contact, newsletter slot, payments
    templates/    Page templates (see "Layout and page templates" below)
  brand/          Logo component
features/         Feature modules, one folder per domain (cart, catalog, checkout, …)
  cart/           Cart store (Zustand) and cart components
  catalog/        Product cards and grids
lib/
  erp/            ERP client layer (server only): see "ERP client" below
  auth/           Authentication and session handling
  utils/          Small shared helpers
  brand.ts        Brand name, tagline, logo paths, manifest colours
  site-config.ts  Business details: contact, social, payments, outlets
  content-pages.ts Footer page paths and titles, old-site redirects
  cache-tags.ts   Cache tag names used for on-demand revalidation
  env.ts          Public env (validated)
  env.server.ts   Server-only env (validated)
  query-client.ts TanStack Query client factory
styles/
  tokens.css      Design tokens: colours, type, spacing, radius, shadows, breakpoints
  globals.css     Tailwind import and base element styles
public/
  brand/          Logo files (full with tagline, compact)
  icons/          PWA icons (192, 512, maskable)
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

### Catalog pages (`app/(site)/(catalog)/`)

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

### Keeping data fresh (BUN-167)

There are three layers, from fastest to slowest:

| Layer                   | Delay             | How                                                                                                                                                              |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ERP webhook             | Seconds           | The ERP calls the signed `POST /api/revalidate` when something changes                                                                                           |
| Scheduled catalog check | At most 5 minutes | `POST /api/cron` (every minute) reads the ERP catalog live every 5 minutes, compares fingerprints, and refreshes exactly what changed (`lib/freshness/check.ts`) |
| Time-based refresh      | 15 minutes        | The `catalog` cache profile, for everything else                                                                                                                 |

So a price or visibility change is live within seconds, and **within 5 minutes even if a webhook is lost**.

#### On-demand revalidation webhook

```http
POST /api/revalidate
X-Erp-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with ERP_WEBHOOK_SECRET>
Content-Type: application/json

{ "type": "product", "slug": "<product-slug>" }
```

| `type`     | Body needs                              | Refreshes                                                                             |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| `product`  | `slug` (+ `previous_slug` when renamed) | That product page (and its old URL), plus every product list (category, home, search) |
| `category` | `slug` (+ `previous_slug`)              | That category page, plus every menu and category list                                 |
| `home`     | —                                       | Home page featured products                                                           |
| `banners`  | —                                       | Home page banners                                                                     |
| `schemes`  | —                                       | Offer badges everywhere                                                               |
| `all`      | —                                       | The whole catalog (bulk imports, price lists)                                         |

Several changes can be sent at once as `{ "events": [ … ] }` (up to 200).

- **Signed:** requests must be signed with the shared `ERP_WEBHOOK_SECRET` (`lib/webhooks/signature.ts`, the same scheme as the order status webhook).
  - **Unsigned or wrongly signed requests are rejected (401).**
  - A captured request can't be replayed: anything more than 5 minutes old is refused.
- **Responses:**
  - `200 {"revalidated": [...tags]}`
  - `401` unsigned, bad or old signature
  - `400` invalid body
  - `503` when `ERP_WEBHOOK_SECRET` isn't set
- **Sending one by hand:** `node scripts/send-erp-webhook.mjs <url> '<json>'` sends a correctly signed request, for testing or a manual refresh.

Pages keep serving the old version until the new one is ready, so visitors never wait. Tag names are in `lib/cache-tags.ts`. When adding a cached read, give it the matching tags.

#### Background jobs: `POST /api/cron`

Schedule **one** request every minute, with `Authorization: Bearer <ORDERS_OPS_SECRET>`:

```
curl -X POST -H "Authorization: Bearer $ORDERS_OPS_SECRET" https://<site>/api/cron
```

It runs every job; each keeps its own pace:

- order submissions due for a retry (BUN-164);
- order statuses not checked for 5 minutes (BUN-165);
- customer changes to send (BUN-166);
- the catalog check every 5 minutes (BUN-167).

One failing job doesn't stop the others. `POST /api/orders/retry` stays for re-sending one order by hand.

### Per-user pages (`app/(site)/(private)/` and `app/(checkout)/`)

Cart, checkout and account pages are never cached for other users:

- Per-user server data (the session, orders) is read with `cookies()` inside `<Suspense>`, which makes that part render on every request.
- The `(private)` and `(checkout)` layouts set `ensureStatic = false`, so these routes can never be forced static. It also sets `robots: noindex`.
- `next.config.ts` sends `Cache-Control: private, no-store, max-age=0` for `/cart`, `/checkout` and `/account`, so browsers, proxies and CDNs never store them.

### Adding a page

1. Is it the same for every visitor? Put it in `app/(site)/(catalog)/`, read data through cached functions in `lib/erp`, and add `generateStaticParams` for dynamic routes.
2. Does it show per-user data? Put it in `app/(site)/(private)/` (and add its path to `PRIVATE_PATHS` in `next.config.ts`). Read the session inside `<Suspense>`.
3. Does it depend on the query string? Read `searchParams` inside `<Suspense>`, as in `app/search/page.tsx`.

## Code quality

- **ESLint** uses `eslint-config-next` (Core Web Vitals + TypeScript), with `eslint-config-prettier` so it doesn't conflict with Prettier.
- **Prettier** includes the Tailwind class-sorting plugin. Settings are in `.prettierrc.json`.
- **Husky pre-commit hook** runs `lint-staged` (ESLint `--fix` and Prettier on staged files) and then `npm run typecheck`. A commit is blocked if either fails.

## Design system

Styling uses Tailwind CSS v4. All design tokens live in **`styles/tokens.css`**, and every token becomes a Tailwind utility. Open **[/style-guide](http://localhost:3000/style-guide)** for a live visual reference of every colour, type size, spacing step, radius, shadow and breakpoint, plus the logos.

### Look and feel (BUN-249)

A clean marketplace layout, in Buntalk's own colours:

- **Page and type:**
  - The page is white. `surface-muted` is used for soft panels, product image wells and the search field.
  - Headings are an extra-bold sans (Nunito). The rounded brand face (Baloo 2) is kept for big hero headlines (`text-display`).
- **Shapes:**
  - Buttons, the search box, chips and category tiles are pills or circles (`rounded-full`).
  - Cards and tiles use large radii (`rounded-xl`, and `rounded-2xl` for banners).
  - Product cards have no border or shadow: a rounded photo well, a two-line name and the price.
- **Price:** shown as a bold amount with a small currency code ("LKR **4,500.00**").

### Rules

- **No hard-coded colours.** Use semantic colour tokens (`bg-primary`, `text-heading`, `border-border`, …). ESLint fails on hex, `rgb()`, `hsl()` and `oklch()` colours in `app/`, `components/` and `features/`.
- Tailwind's default palette, type sizes, radii, shadows and breakpoints are **removed**. Classes like `bg-blue-500`, `text-2xl` or `rounded-3xl` don't exist, so only the Buntalk tokens can be used.
- Use **semantic tokens** in components. Use the raw palette (`orange-*`, `red-*`, `brown-*`, `sand-*`) only for brand illustrations or when no semantic token fits.
- To change a colour, size or spacing value, edit `styles/tokens.css`. Every page and the style guide update with it.

### Colours

Brand colours come from the logo:

| Colour     | Hex       | Source             | Token        |
| ---------- | --------- | ------------------ | ------------ |
| Orange     | `#F38121` | Logo frame         | `orange-500` |
| Red-orange | `#EE5023` | "Bun"              | `red-500`    |
| Brown      | `#794224` | "Talk" and tagline | `brown-700`  |

Each colour has a full 50–950 scale, plus a warm neutral `sand-*` scale. Components use semantic tokens, which switch automatically for dark mode (follows the system setting):

| Token                                    | Use                                         |
| ---------------------------------------- | ------------------------------------------- |
| `background`, `surface`, `surface-muted` | Page, cards/inputs, subtle sections         |
| `foreground`, `muted-foreground`         | Body text, secondary text                   |
| `heading`                                | Headings and brand text (brand brown)       |
| `primary` / `primary-foreground`         | Main buttons and links                      |
| `secondary` / `secondary-foreground`     | Secondary buttons                           |
| `accent`, `accent-soft`                  | Brand orange highlights, badges, pills      |
| `border`, `border-strong`, `ring`        | Borders, input borders, focus outline       |
| `success`, `warning`, `danger`, `info`   | Status text, each with a `-soft` background |

Brand orange is too light for text on white (2.6:1), so it's used for backgrounds and decoration only. Text and button pairs meet WCAG AA:

- White on `primary`: 4.9:1
- `heading` on white: 8:1
- Body text: 17.8:1

### Typography

| Font              | Use                                                   | Class          |
| ----------------- | ----------------------------------------------------- | -------------- |
| Baloo 2           | Headings (rounded, matches the logo lettering)        | `font-display` |
| Nunito            | Body text (default)                                   | `font-sans`    |
| Noto Sans Sinhala | Sinhala text, and the fallback for Sinhala characters | `font-sinhala` |

Fonts are loaded with `next/font` in `app/layout.tsx`.

The type scale is `text-display`, `text-h1`–`text-h4`, `text-body-lg`, `text-body`, `text-body-sm` and `text-caption`:

- Display and heading sizes scale smoothly from mobile to desktop.
- `h1`–`h4` elements get the display font and heading colour automatically.

### Spacing, radius, shadows, layout

- **Spacing:** a 4px unit (`p-1` = 4px, `p-4` = 16px, `gap-6` = 24px).
- **Content widths:** `max-w-page` (1152px), `max-w-content` (768px) and `max-w-prose` (640px).
- **Radius:**
  - `rounded-sm` (6px): inputs
  - `rounded-md` (10px): buttons
  - `rounded-lg` (16px): cards
  - `rounded-xl` (24px): large panels
  - `rounded-full`: pills
  - `rounded-brand`: the logo's frame shape
- **Shadows:** `shadow-xs` to `shadow-lg`, with a warm tint.

### Breakpoints

Layouts are mobile first: classes without a prefix apply to phones.

| Prefix | From   | Device       |
| ------ | ------ | ------------ |
| `sm:`  | 640px  | Large phones |
| `md:`  | 768px  | Tablets      |
| `lg:`  | 1024px | Desktop      |
| `xl:`  | 1280px | Wide desktop |

### Brand assets

| Asset                          | File                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| Full logo with Sinhala tagline | `public/brand/buntalk-logo.png`                            |
| Compact logo (header)          | `public/brand/buntalk-logo-compact.png`                    |
| Favicon / browser icon         | `app/icon.png`                                             |
| Apple touch icon               | `app/apple-icon.png`                                       |
| Installed-app icons            | `public/icons/` (192, 512, maskable), in `app/manifest.ts` |
| Social share image             | `app/opengraph-image.png`                                  |

- In code, use `<Logo variant="full" | "compact" />` from `components/brand/Logo.tsx`.
- Brand values that CSS can't provide (manifest colours, tagline, logo sizes) are in `lib/brand.ts`. They must match `tokens.css`.

All logo and icon files are made from the supplied PNG logo. A vector (SVG) version from the designer would give sharper icons at small sizes. When it's available, drop it into `public/brand/` and regenerate the icons.

## UI components

Shared components live in `components/ui` and are imported from one place:

```tsx
import { Button, FormField, Input, toast } from "@/components/ui";
```

Live examples, with code for each component: **[/style-guide/components](http://localhost:3000/style-guide/components)**.

| Group      | Components                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Actions    | `Button` (primary, secondary, outline, ghost, danger; sm, md, lg; loading), `buttonClasses()` for links |
| Forms      | `FormField` (label, hint, error), `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `RadioGroup`      |
| Display    | `Card`, `CardTitle`, `CardDescription`, `Badge`                                                         |
| Overlays   | `Dialog`, `Drawer` (right, left, bottom), `toast` + `Toaster`                                           |
| Navigation | `Tabs`, `Accordion`, `Breadcrumb`, `Pagination`                                                         |
| Feedback   | `Spinner`, `Skeleton`, `ProductCardSkeleton`                                                            |
| Commerce   | `QuantityStepper`                                                                                       |

### How they're built

- **Design tokens only.** Components use the semantic tokens from `styles/tokens.css`, so light and dark mode and brand changes apply everywhere.
- **States:**
  - `disabled` on every control.
  - `loading` on `Button`, which shows a spinner, disables the button and sets `aria-busy`.
  - `error` on `FormField`, `Checkbox` and `RadioGroup`, which marks the control `aria-invalid`, links the message with `aria-describedby` and announces it.
- **Native HTML first.** Native elements give keyboard and screen-reader support for free:
  - `Dialog` and `Drawer` use `<dialog>`: focus stays inside, Esc and clicking outside close it, and focus returns to the opener.
  - `Accordion` uses `<details>`, so it works without JavaScript.
  - `Checkbox` and `Radio` use the native inputs.
- **Branded dropdown.** `Select` draws its own list instead of the browser's default one. Pass `options={[{ value, label, disabled? }]}`; with `name`, the value is sent with the form through a hidden input. It follows the WAI-ARIA select-only combobox pattern, so it works like a native select: arrow keys, Home/End, Enter/Space, Escape, Tab and type-to-select, with focus kept on the button. It opens upwards when there's no room below. The "Sort by" control on listings uses it, with a native select inside `<noscript>` as the no-JavaScript fallback.
- **Keyboard:**
  - Every control shows a visible focus outline.
  - `Tabs` use the arrow keys and Home/End, and skip disabled tabs.
  - `QuantityStepper` buttons disable at the min and max.
- **Server-friendly.**
  - Server Components: `Button`, `Card`, `Badge`, `Accordion`, `Breadcrumb`, `Pagination`, `Spinner` and `Skeleton`.
  - Client components (they need browser state): form controls, overlays, `Tabs`, `toast` and `QuantityStepper`.
  - `Pagination` and `Breadcrumb` render real links.
- **Toasts:**
  - Mounted once in `app/providers.tsx`. Call `toast.success()`, `toast.error()` or `toast.info()` from client code.
  - Errors stay until dismissed, and other toasts close after 5 seconds.

When you add a component, put it in `components/ui`, export it from `components/ui/index.ts`, and add an example to `app/style-guide/components/page.tsx`.

## Layout and page templates

### Page shell

Every page sits in `PageShell` (`components/layout/PageShell.tsx`), which provides three slots: **header**, **main content** and **footer**.

- It starts with a "Skip to content" link for keyboard users.
- It renders the page's single `<main>`.
- It keeps the footer at the bottom on short pages.

The header and footer come from the route group layouts:

| Route group  | Layout                      | Header and footer                                        |
| ------------ | --------------------------- | -------------------------------------------------------- |
| `(site)`     | `app/(site)/layout.tsx`     | Full site header (logo, navigation) and the full footer  |
| `(checkout)` | `app/(checkout)/layout.tsx` | Minimal header (logo, "Back to cart") and a short footer |

Pages don't render `<main>` themselves. They render a template, or a `Container`.

### Templates

All templates are in `components/layout/templates`:

```tsx
import { ListingTemplate } from "@/components/layout/templates";
```

| Template            | Used by                                        | Phone (from 360px)                                           | Tablet (`md`, 768px)           | Desktop (`lg`, 1024px+)                                         |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------- |
| `FullWidthTemplate` | Home                                           | Stacked full-width sections (`FullWidthSection`)             | Same                           | Same, content capped at 1152px                                  |
| `ListingTemplate`   | Category, search                               | Sidebar moves into a drawer behind a button; full-width grid | Same; 2-column grid            | Sidebar column (16rem) + 3-column grid                          |
| `DetailTemplate`    | Product                                        | Breadcrumb, image, summary, details stacked                  | Image and summary side by side | Wider image column; summary stays in view while scrolling       |
| `CheckoutTemplate`  | Checkout                                       | Order summary first, then the form                           | Same                           | Form left, order summary in a column that stays in view (22rem) |
| `AccountTemplate`   | Account (overview, orders, addresses, profile) | Account menu as a row of tabs that scrolls inside itself     | Same                           | Side menu column (14rem)                                        |

Shared pieces:

- **`Container`:** centres content at `page`, `content` or `prose` width. It adds 16px side padding on phones and 24px from tablets up.
- **`PageHeader`:** breadcrumb, `<h1>`, description and actions.

### Responsive rules

- Design for 360px first.
- Grid and flex children that hold text get `min-w-0`, so long words wrap instead of widening the page.
- Long titles use `break-words`.
- Anything wider than the screen, such as the account menu or tab rows, scrolls inside its own `overflow-x-auto` box. The page itself never scrolls sideways.
- As a last safety net, `PageShell` clips sideways overflow. Don't rely on it: the layout check below looks for overflowing elements, not just the page's scroll width.

**Layout check:** every page has been checked at 360px, 768px and 1280px for elements wider than the screen. Repeat this when adding a template.

## Site header

`components/layout/header/SiteHeader.tsx` is shown on every page in the `(site)` group. Checkout uses its own minimal header.

| Part       | Phone / tablet (below `lg`)                                   | Desktop (`lg`+)                                                                                                      |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Navigation | ☰ button opens a drawer: categories, account links, language | "All categories" pill (mega-menu) plus links to the first 6 categories; "Cake Studio" and "Our outlets" on the right |
| Search     | Pill search box in its own row under the logo, always visible | Wide pill search box between the logo and the account links (a form to `/search`, with type-ahead suggestions)       |
| Cart       | Bag icon with item count                                      | Same, with a "Cart" label                                                                                            |
| Account    | Person icon opens the account / sign-in menu                  | Same, with a "Sign in" or "Account" label                                                                            |
| Language   | In the drawer                                                 | Slot next to the account menu (switcher comes with BUN-211)                                                          |

### How it works

- **Categories come from the ERP.** `SiteHeader` reads `getCategories()`, the cached ERP read from `lib/erp`. Nothing is hard-coded, and the `catalog` cache tag refreshes the menu with the rest of the catalog.
- **The header HTML is the same for every visitor**, so it can be cached with the page. Anything per-visitor is filled in in the browser:
  - **Cart count:** `CartButton` reads the cart store, so the count changes as soon as an item is added. The server always renders "Cart, empty".
  - **Signed-in state:** `AccountMenu` calls `GET /api/session` (never cached), which returns only `{ signedIn }`.
- **It stays at the top when scrolling.** The header uses `position: sticky` and gets a shadow once the page scrolls.
  - Its height is in `--header-height` (`styles/globals.css`): 120px on phones and tablets (top row plus search row), 112px from `lg`.
  - Sticky columns use `top-(--sticky-offset)` so they sit below the header, and anchor links scroll their target clear of it.
  - If you change the header's height, update the variable.

### Keyboard and screen readers

- **Mega-menu:** a disclosure button (`aria-expanded`). Tab moves through its links. Esc closes it and returns focus to the button, and clicking outside or tabbing away also closes it.
- **Mobile drawer:** the shared `Drawer` (native `<dialog>`). Focus moves in and Tab stays inside. Esc or the × button closes it, and focus returns to the ☰ button. It also closes when you follow a link.
- **Cart link:** has a spoken label such as "Cart, 3 items".
- **Current page:** marked with `aria-current="page"`.

## Site footer

`components/layout/footer/SiteFooter.tsx` is shown on every page in the `(site)` group. Checkout has a minimal footer that still links every policy.

| Block        | Contents                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Brand        | Logo and Sinhala tagline                                                                                   |
| Get in touch | Address, phone, WhatsApp, email, opening hours, social links, plus "Contact us" and "Find an outlet" links |
| Newsletter   | Sign-up slot, disabled until a mailing-list service is connected                                           |
| Link groups  | **Shop** (ERP categories), **Customer help**, **Company**, **Policies**                                    |
| Bottom row   | Payment method badges and the copyright line ("© 2023 – {current year} Buntalk (Private) Limited")         |

- **Responsive:**
  - From desktop (`lg`) up, the four link groups are columns.
  - On phones and tablets they collapse into accordions (native `<details>`, so they work with the keyboard and without JavaScript).
  - The policy links are also shown as always-visible quick links there.
- **Shop links** come from the ERP categories, like the header.

### Business details: `lib/site-config.ts`

All contact details, social links, payment methods and outlets live in this one file. **Empty values are hidden.** The footer, contact page and outlet page never show made-up details.

The values were checked against the old site (buntalk.lk) on 22 Nov 2026:

| Detail                  | Status                                                                      |
| ----------------------- | --------------------------------------------------------------------------- |
| Legal name, address     | Filled in from the old site                                                 |
| Phone                   | **Needed.** The old site shows a placeholder (`+94 123 456 7890`)           |
| Email                   | **Needed.** Hidden by Cloudflare's email protection on the old site         |
| WhatsApp, opening hours | **Needed.** Not on the old site                                             |
| Social media links      | **Needed.** Not on the old site                                             |
| Outlets                 | **Needed.** Not on the old site. `/outlets` shows "coming soon" until added |
| Payment methods         | **Needed.** Decide with the payment gateway work (BUN-203)                  |

### Information pages: `app/(site)/(content)/`

| Page                    | Path                    | Old buntalk.lk address (redirects here)        |
| ----------------------- | ----------------------- | ---------------------------------------------- |
| Privacy policy          | `/privacy-policy`       | `/page/privacy-policy`                         |
| Terms and conditions    | `/terms-and-conditions` | `/page/terms-conditions`, `/page/terms-of-use` |
| Refund and returns      | `/refund-policy`        | `/page/refund-policy`                          |
| Delivery policy         | `/delivery-policy`      | `/page/shipping-policy`                        |
| Payment policy          | `/payment-policy`       | `/page/payment-policy`                         |
| About us                | `/about`                | `/page/about-us`                               |
| Help & customer service | `/help`                 | `/page/customer-service`                       |
| Contact us              | `/contact`              | `/contact`                                     |
| Outlet locator          | `/outlets`              | none                                           |

- Paths and titles are defined once, in `lib/content-pages.ts`.
- The old addresses redirect permanently (308), so existing links and search rankings carry over when the domain moves to this site.
- **Policy, about and help text is still needed.** The old site's versions were template text, with unfilled placeholders such as "[insert email address]" and a "we do not ship outside the U.S." line, so they weren't copied. Until real text arrives, these pages show a "This page is being updated" notice.

## Home page

`app/(site)/(catalog)/page.tsx` uses the full-width template. Sections live in `features/home/`.

| Section                     | Data                                                                                                                                                           | Shown when                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Hero slider + deal tile     | `getHomeBanners()` as a swipeable slider (2/3 width); the deal tile shows the product with the biggest saving from `getOfferProducts()`, or a Cake Studio tile | Always (branded welcome slide if there are no banners) |
| Explore our categories      | `getCategories()`: top-level categories as round tiles in a scrolling row with arrow buttons                                                                   | There are categories                                   |
| Today's best deals for you  | `getOfferProducts()` as a product row                                                                                                                          | There are offers                                       |
| Collection tiles            | The first three top-level categories as tall promo tiles                                                                                                       | There are categories                                   |
| Buntalk favourites          | `getFeaturedProducts()` as a product row                                                                                                                       | There are featured products                            |
| Best of {category}          | `getProductsByCategory()` for the first two top-level categories, with "View all"                                                                              | The category has products                              |
| Cake Studio                 | Static band linking to `/cake-studio` (placeholder until BUN-179 to BUN-183)                                                                                   | Always                                                 |
| Delivery, outlets, payments | `lib/site-config.ts`. States only configured facts; otherwise links to the policy or outlet page                                                               | Always                                                 |
| Newsletter                  | Sign-up slot (disabled until a mailing-list service is connected)                                                                                              | Always. The footer hides its own copy on this page     |

**Product rows** (`ProductRail`) show five products across on desktop. On phones and tablets they swipe sideways with scroll-snap, using no JavaScript.

### Live data and speed

- **Live data:** every section reads through the cached ERP functions in `lib/erp`. Nothing is hard-coded.
- **Static page:** the page is prerendered to static HTML and refreshed every 15 minutes. A `POST /api/revalidate` with `{ "type": "home" }` refreshes banners and featured content right away.
- **The hero slider never moves by itself.** Auto-rotation moves content while people read, and is hard to use with a keyboard or screen reader.
  - It moves only when the visitor swipes or uses the arrows or dots.
  - It is plain horizontal scrolling with scroll-snap, so touch, trackpads and the keyboard all work.
  - The dots follow the scroll position.
- **Image priority:** only the hero image is loaded with priority.
- **Measured locally, production build:** HTML is 14 KB gzipped and served from cache. JavaScript is about 206 KB gzipped, of which about 157 KB is React and the Next.js runtime. There's one `<h1>` and no duplicate IDs. No layout overflows at 360, 768 or 1280px.
- **Not run:** a Lighthouse audit, which was blocked in this environment. Run it in Chrome DevTools, or use `npx lighthouse http://localhost:3000 --form-factor=mobile`.

### ERP data still to connect (BUN-159)

These endpoints are placeholders in `lib/erp/catalog.ts`:

- Banners: `content/banners?placement=home`
- Offers: `catalog/products?on_offer=true`. Real offer prices come from the scheme engine (BUN-163, BUN-174).
- Banner and category images: add the ERP image host to `images.remotePatterns` in `next.config.ts`, then remove `unoptimized` from the banner and category `<Image>`s to get resized, modern-format images.

## Orders

The ERP is the system of record for orders. The storefront also keeps its own copy of every order, in its own PostgreSQL database, so that:

- an order is never lost when the ERP is down;
- the ERP order number is stored next to the storefront order;
- failed submissions are retried and are visible to the team.

### Database

- **Database:** PostgreSQL with Drizzle ORM. The schema is in `lib/db/schema.ts` and the migrations in `drizzle/`.
  - `orders`: the order snapshot (lines, prices, offers, customer, delivery, payment), the ERP status and ids, and the retry state.
  - `order_events`: the audit trail (placed, submitted, failed with the error, rejected, requeued).
- **Production and staging:** set `DATABASE_URL`, then run `npm run db:migrate` as a deploy step.
- **Local development:** leave `DATABASE_URL` empty. An embedded **PGlite** database (real Postgres in WebAssembly) is created in `node_modules/.cache/buntalk/pglite` and migrated automatically, so nothing needs installing. It lives outside the dev server's file watcher (a watched folder would rebuild the app on every database write) and is wiped with `node_modules`.
- **Schema changes:** edit `lib/db/schema.ts`, then run `npm run db:generate` and commit the new migration.

### Placing an order: `POST /api/orders`

The checkout page (BUN-201) sends the cart lines, customer, delivery or pickup details and the payment method. It never sends prices.

1. **Prices:** the server prices the cart from the ERP (`priceCart`: live prices and the scheme engine). If anything was hidden or sold out, it refuses with **409 `cart_changed`**.
2. **Saved first:** the order is saved with an order number such as `BT-261122-7K3QX`, before anything is sent to the ERP.
3. **Idempotent:** each checkout attempt has an `idempotencyKey`. Sending it again, even at the same moment, returns the same order (200) and never creates a second one.
4. **Sent at once:** the server tries to send the order to the ERP straight away. If the ERP can't take it, the order is still placed (status "received"), and the retry queue sends it later.

### Sending to the ERP (`lib/orders/submit.ts`)

1. **Customer:** the ERP customer is the signed-in customer, or is matched or created by phone (`POST /customers`).
2. **Order:** then `POST /orders` (contract: `docs/erp-api-contract.md`, "Orders").
   - Both writes send an `Idempotency-Key` derived from the order, so a retry after a timeout returns the existing ERP order.
3. **One sender at a time:** an order is claimed with one atomic update, so two retry runs can't send it twice. A claim older than 5 minutes (a crashed worker) is taken over.

| What happens                                  | Status      | Next                                                                                                   |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| ERP accepts                                   | `submitted` | `erp_order_number` stored                                                                              |
| ERP down, timeout, 429, 5xx, bad credentials  | `failed`    | Retried after 1, 2, 4, 8 … minutes (at most 1 hour apart), up to 8 attempts, then given up and alerted |
| ERP refuses (409 prices changed, 422 invalid) | `rejected`  | Not retried; the team is alerted at once                                                               |

### Retry queue and alerts

- **Retry queue:** the every-minute `POST /api/cron` (see "Background jobs") sends every order that is due. `POST /api/orders/retry` does the same on demand. Run the cron **every minute** from a scheduler, for example the hosting platform's cron:

  ```
  curl -X POST -H "Authorization: Bearer $ORDERS_OPS_SECRET" https://<site>/api/cron
  ```

  Sending `{"number":"BT-…"}` puts one failed or rejected order back in the queue and sends it now.

- **Visibility:** `GET /api/orders/failed` (same secret) lists the orders to look at: failed, rejected, or not in the ERP after 10 minutes. Each comes with its last error and attempt count.
- **Alerts:**
  - Every alert is written to the server log as `[orders:alert] {…}`.
  - When `ALERT_WEBHOOK_URL` is set (a Slack or Teams incoming webhook), the alert is also posted there.
  - An alert is sent for: a rejected order, bad ERP credentials, 3 failed attempts in a row, and giving up.

### Order status (BUN-165)

Each order's fulfilment status is kept in step with the ERP (`lib/orders/sync.ts`). There are three ways in, and an older or repeated update never overwrites a newer status:

| Way               | Delay             | How                                                                                                                |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| ERP webhook       | Seconds           | `POST /api/webhooks/erp/order-status`, signed with HMAC-SHA256 (`ERP_WEBHOOK_SECRET`, `lib/orders/webhook.ts`)     |
| Polling           | At most 5 minutes | The every-minute cron (`POST /api/cron`) also reads open orders not checked for 5 minutes                          |
| Viewing the order | Up to 1 minute    | The order page re-checks with the ERP when the status is over a minute old, then refreshes itself every 30 seconds |

- **Customer words** (`lib/orders/status.ts`): Order received, Order confirmed, Being prepared, Ready for delivery / Ready to collect, Out for delivery, Delivered / Collected, Cancelled. A timeline shows the steps, and pickup has no "Out for delivery" step.
- **Order page:** `/orders/{number}?token={token}` is private and works without signing in.
  - The link comes back as `trackingUrl` when the order is placed, for the confirmation page and messages (BUN-202).
  - A wrong token gives a 404.
  - The account order pages (BUN-194) reuse `OrderStatusCard`.
- **ERP side:** the ERP doesn't have this workflow or the webhook yet (BUN-253). Until it does, the mock ERP's `POST /__mock/orders/status` changes a status and sends the signed webhook. Set `MOCK_STOREFRONT_WEBHOOK_URL` and `MOCK_ERP_WEBHOOK_SECRET` for it.

### Not built yet

- **Delivery fees:** there are no delivery fees, areas or slots in the ERP yet (BUN-251), so the fee is 0.
- **Cake Studio:** cake lines arrive with BUN-184, and the ERP side is BUN-252.
- **Payment status:** "pending" until payments exist (BUN-203).
- **Checkout form:** the form that calls this API is BUN-201.

## Customers

Every storefront customer has exactly one linked ERP customer (BUN-166). The code is in `lib/customers/`.

- **Storage:** the `customers` table (name, phone, email, ERP link, sync state) and `customer_addresses` (saved addresses with one default).
  - Phone numbers are stored as `+94…` and emails in lower case. `077 123 4567`, `+94 77-123-4567` and `0771234567` are the same number.
  - The same phone or email can't register twice (409 `phone_taken` / `email_taken`).
- **Linking:**
  - The first sync calls the ERP's `POST /customers`, which matches by phone, then email, or creates.
  - A shop customer who signs up online is **linked, not duplicated**.
  - `erp_customer_id` is unique, so one ERP customer can never be linked to two storefront accounts.
- **Changes reach the ERP:**
  - Every profile or address change bumps the customer's `version`. The sync worker sends the full profile with `PUT /customers/{id}` and records the version the ERP has.
  - A change made while a sync is running is sent on the next run.
  - If the ERP customer was merged away (404), the customer is linked again by phone.
- **Sync status:** `pending` → `synced`. Two other outcomes:
  - **failed** (ERP down): retried after 1, 2, 4 … minutes, up to 8 attempts, with an alert after 3.
  - **conflict**: the phone or email belongs to another ERP customer, or two accounts match one ERP customer. Nothing is merged by guesswork; the team is alerted.
- **Operations:**
  - The every-minute cron (`POST /api/cron`) also runs the customer queue.
  - `GET /api/customers/failed` (with `ORDERS_OPS_SECRET`) lists conflicts and failures.
  - Alerts use the shared `lib/alerts.ts` (`[customers:alert]` in the log, plus `ALERT_WEBHOOK_URL`).
- **Who calls it:**
  - Registration (BUN-187/192), the profile page (BUN-193) and saved addresses (BUN-198) use these functions, behind sign-in (BUN-186). There is deliberately no public API until then.
  - Checkout uses the same phone format, so a guest order and a later sign-up match the same ERP customer.
- **ERP side:** updates, structured addresses and merges need BUN-254. The mock ERP already implements them, and `customers.integration.test.ts` tests the real client against it.

## Errors, 404 and empty states

### 404: page not found

- Unknown URLs and `notFound()` (a product or category that doesn't exist) return **HTTP 404** with a custom page. It has a search box, popular categories and a link home, and is marked `noindex`.
- There are two `not-found.tsx` files:
  - `app/not-found.tsx` is for URLs that match no route. It adds the site header and footer itself.
  - `app/(site)/not-found.tsx` is for `notFound()` inside storefront pages, which already have the header and footer.
  - Both use `features/content/NotFoundContent.tsx`.

### Errors: 500 and ERP unavailable

| Where it fails                         | What shows                                     | File                       |
| -------------------------------------- | ---------------------------------------------- | -------------------------- |
| A storefront page                      | Error screen inside the site header and footer | `app/(site)/error.tsx`     |
| Checkout                               | Error screen inside the checkout header        | `app/(checkout)/error.tsx` |
| A layout (e.g. the site header itself) | Error screen with a minimal logo header        | `app/error.tsx`            |
| The root layout                        | Standalone error page                          | `app/global-error.tsx`     |

All four use `components/feedback/ErrorContent.tsx`:

- It shows "Sorry, something went wrong", says the problem is usually temporary, and offers **Try again** (re-renders the page), **Go to the home page** and **Contact us**.
- It never shows technical details. It shows a **reference code** (the error digest) that matches the server log entry.

**ERP downtime** is handled at several levels:

- **Fail fast:** `erpFetch` gives up after 10 seconds. Network errors, timeouts and 5xx responses become an `ErpUnavailableError`.
- **Cached pages keep working:** pages that were already built (cached) stay up. Next.js keeps serving the last good version if a background refresh fails.
- **Navigation degrades:** the header and footer use `getNavigationCategories()`, which never throws. During an outage they render without category links instead of breaking the page. The error is caught outside the cached read, so the outage isn't cached.
- **Fresh pages show the error screen:** pages that need fresh ERP data show the friendly error screen. Uncached pages return HTTP 500. Search returns 200 because its results stream in after the page starts; search is `noindex`.

Tested by running the production build with `ERP_API_BASE_URL` pointing at a closed port.

### Empty states

`EmptyState` (`components/ui`) always says what happened and offers a next step.

| Where                     | Message                     | Next step                                                       |
| ------------------------- | --------------------------- | --------------------------------------------------------------- |
| Cart                      | "Your cart is empty"        | Start shopping, plus category links (checkout button hidden)    |
| Checkout order summary    | "Nothing to check out yet"  | Continue shopping                                               |
| Search with no results    | "No results for …"          | Tips and popular categories; the search is counted for the team |
| Search with no query      | "What are you looking for?" | Category links                                                  |
| Category with no products | "No products here yet"      | Search products                                                 |
| Account → Orders          | "No orders yet"             | Start shopping                                                  |

## ERP client

All communication with the BrandTalk ERP goes through **`lib/erp`**, server-side only. Features import typed functions and types from `@/lib/erp`:

```ts
import { getProduct, type Product, ErpNotFoundError } from "@/lib/erp";
```

| File                    | What it does                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `http.ts` (internal)    | The one HTTP client: base URL, tenant, API key, time limit, retries, logging, error mapping                                         |
| `errors.ts`             | Storefront error types (below)                                                                                                      |
| `schemas.ts` (internal) | zod shapes of ERP entities (product, category, SKU, price, scheme, customer, order, banner). Every response is checked against them |
| `mappers.ts` (internal) | ERP shapes (`snake_case`, decimal strings) → storefront types                                                                       |
| `types.ts`              | Storefront types used by pages and components                                                                                       |
| `catalog.ts`            | Cached catalog reads (`'use cache'` and cache tags)                                                                                 |
| `sample-catalog.ts`     | Sample data for local development without ERP credentials                                                                           |

The API contract proposed to the ERP team (endpoints, auth, entities, open questions) is in **[docs/erp-api-contract.md](docs/erp-api-contract.md)**.

### Rules, enforced by ESLint

- **Only through `@/lib/erp`:** outside `lib/erp`, you can't import its internals (`@/lib/erp/http`, schemas, mappers).
- **Settings stay in one place:** outside `lib/erp`, you can't import `erpConfig` or read `process.env.ERP_*`. ERP settings are read only in `lib/env.server.ts`, which is `server-only`.
- **No direct ERP calls:** don't `fetch` the ERP directly. Without the credentials such a call can't authenticate anyway.

### Behaviour

- **URL and auth:** requests go to `{ERP_API_BASE_URL}/v1/tenants/{ERP_TENANT}/storefront/…` with `Authorization: Bearer ERP_API_KEY` and an `X-Request-Id`.
- **Time limit:** `ERP_TIMEOUT_MS` per attempt, 8 s by default.
- **Retries:** only for reads (GET), on network errors, timeouts, 429 and 5xx. Up to 2 retries with exponential back-off and jitter, honouring `Retry-After`. Writes are never retried automatically; they send an `Idempotency-Key` instead.
- **Logging:** one line per request, e.g. `[erp] GET /products ok 84ms attempt=1 id=…`. Request bodies, query values and credentials are never logged.
- **Credentials:** verified by building with a dummy `ERP_API_KEY` and checking the browser bundles. Neither the key value nor the variable name appears in them.

### Error types

| Error                 | When                                                  | Typical handling             |
| --------------------- | ----------------------------------------------------- | ---------------------------- |
| `ErpConfigError`      | ERP not configured, or credentials rejected (401/403) | Error page, alert the team   |
| `ErpNotFoundError`    | 404                                                   | `notFound()` or `null`       |
| `ErpValidationError`  | 422; `fieldErrors` has the ERP's messages per field   | Show on the form             |
| `ErpConflictError`    | 409, e.g. stock changed                               | Show `userMessage`           |
| `ErpUnavailableError` | Network error, timeout, 429, 5xx (after retries)      | Error page with Try again    |
| `ErpResponseError`    | Response didn't match the agreed shape                | Error page, fix the contract |

Each error has a customer-safe `userMessage`, plus `status`, `path` and `requestId` for logs.

### Tests

`npm test` runs Vitest. `lib/erp/http.test.ts` covers:

- URL and headers
- No secrets in logs
- Mapping each status to an error type
- Retries with back-off, `Retry-After`, and no retries for writes
- Timeouts
- Malformed responses
- The product mapper

`npm run check` includes the tests.

## Catalog sync

The ERP is the single source of truth for categories and products. The storefront never stores its own copy. It reads through the cached functions in `lib/erp/catalog.ts`.

### Categories

- **Hierarchy:** categories have a parent (`parentId`) and a display order (`sortOrder`), both from the ERP.
- **Order:** they are shown **exactly in the ERP's order**, never alphabetically. Helpers are in `lib/categories.ts`.
- **Where each level shows:**
  - The header mega-menu, the mobile menu and the category sidebar show the tree, with sub-categories under their parent.
  - The footer, the home page tiles and the "popular categories" suggestions show top-level categories only.
- **Breadcrumbs** include the parent categories (Home › Cakes › Birthday cakes › product).
- **Parent pages** list products from their sub-categories too.
- **Missing parent:** a category whose parent is missing is shown at the top level rather than hidden.

### Category pages (BUN-168)

- **URLs:** clean addresses: `/category/birthday-cakes` for one category, `/categories` for all of them.
- **Every visible ERP category has a page.** All are prerendered at build time, and a new category is built on its first visit. Hidden ones return 404 (BUN-161).
- **Header** (`features/catalog/CategoryHeader.tsx`):
  - A breadcrumb: Home › Categories › parents › category.
  - A banner with the name (the page's `<h1>`), the description and the product count.
  - The banner uses the ERP's wide `banner_url`, else the category image, else a branded panel with the category's initial.
- **Sub-categories** (`SubcategoryLinks`): chips for the category's sub-categories in ERP order. A category without sub-categories shows its sister categories instead ("More in Cakes").
- **Sidebar:** the full category tree, with the current category highlighted. On phones it's in a "Categories" drawer.
- **All categories** (`/categories`): every top-level category with its sub-categories, in ERP order. It's linked from the mega-menu ("View all categories"), the home page ("View all") and the breadcrumb.

### Sorting and pagination (BUN-169)

- **One listing for everything:** category pages and search results use the same server component, `features/catalog/ProductListing.tsx`.
  - It shows a product count ("Showing 25–48 of 57 products"), a "Sort by" control, the grid and page links.
  - The grid is 2 columns on phones, 3 on tablets and 4 on desktop, with 24 products per page.
- **In the URL:** `?sort=` and `?page=`, for example `/category/buns?sort=price-asc&page=2`. Every view is shareable and Back/Forward safe.
  - The page links are real links, so search engines can follow them.
  - An unknown sort falls back to Recommended, and a page past the end is a 404.
- **Sorts** (`lib/listing.ts`):
  - **Recommended** (featured first, then the ERP's order) and price low-to-high / high-to-low (the price on the card, the lowest size price) are always available.
  - **Most popular** and **Newest** appear once the ERP sends `popularity` and `created_at` (BUN-256).
  - Ties keep the ERP's order.
- **Sort control:** a GET form (Next's `<Form>`). Choosing an option navigates to the new URL, and without JavaScript an "Apply" button does the same.
- **Rendering:**
  - The catalog layout requires the shell and prefetch to be static (`ensureStatic = 'prefetch'`). Home, all-categories and product pages require the complete page (`'navigation'`).
  - On category pages the header, banner and sidebar are prerendered. The product grid depends on the URL, so it renders per request from the cached ERP read, inside `<Suspense>` with a skeleton, and is streamed into the same server-rendered response.

### Products

These ERP fields map to storefront fields:

| ERP field                                | Storefront field                                  |
| ---------------------------------------- | ------------------------------------------------- |
| name, description                        | `name`, `description`                             |
| `code`                                   | `code`, shown as "Item code"                      |
| `image_url` and `gallery_urls`           | `imageUrls`                                       |
| option types and values                  | `attributes`, e.g. Size: 1 kg, 2 kg               |
| category                                 | `categorySlug`                                    |
| `processing_time_hours`                  | `processingTimeHours`, shown as "Ready in 2 days" |
| SKUs and prices                          | `skus`, `price`                                   |
| `short_description` (BUN-257)            | `shortDescription`, shown by the price            |
| `net_weight_grams`, `servings` (BUN-257) | `netWeightGrams`, `servings` (product and size)   |
| SKU `image_url` (BUN-257)                | `skus[].imageUrl`, the size's own photo           |
| `is_customisable`                        | `customizable` (Cake Studio product)              |

### Product card (BUN-170)

`ProductCard` (`features/catalog/ProductCard.tsx`) is the one card for products everywhere: category and search listings, home page rows, and "You may also like" on the product page (other products from the same category). It shows:

- the photo, with badges on it:
  - "Save 20%" and the offers ("Buy 2 get 1 free"), **only while an ERP scheme applies** to the product (see Offers below);
  - "Customizable" for Cake Studio products (ERP `is_customisable`).
- the name (two lines at most) and the price, with the original price crossed out when discounted, or "From …" when sizes are priced differently.
- one button (`ProductCardAction`):

| Product              | Button                                          |
| -------------------- | ----------------------------------------------- |
| Cake Studio product  | "Customize", opens Cake Studio for that product |
| Every size sold out  | "Sold out" (disabled)                           |
| Several sizes        | "Choose size", opens the product page           |
| One size or no sizes | "Add to cart", adds 1 straight away             |

The quick "Add to cart" goes through the same server check as the product page (`useAddToCart` in `features/cart`): the ERP confirms the product and price, then a toast confirms it. The whole card links to the product page; the button sits above that link, so clicking it doesn't open the page.

### Product page (BUN-171)

`/product/<slug>` is server-rendered and cached (static + ISR); a hidden or unknown product is a 404. It has:

- **Photo gallery** (`features/product/ProductGallery.tsx`): one large photo, swipe on phones (CSS scroll-snap), arrows on desktop, and thumbnails. Click a photo to open it large; click again (or "Zoom in") to zoom and move the pointer to look around; ← → move between photos, Esc closes. A photo that fails to load is dropped.
- **Name, short description** (with "Read more" down to the full description), **price** (with the discount, BUN-170) and the **weight and servings** of the picked size.
- **Size picker:** picking a size updates the price, weight, servings and photo (the size's own photo comes first). The picker and gallery share the picked size through `SelectedSkuProvider`. Sold-out sizes can't be picked.
- **Quantity and "Add to cart"**, checked with the ERP on the server, so hidden, removed or sold-out products can't be added. Cake Studio products show **"Customize in Cake Studio"** instead.
- **Earliest ready time:** "Ready in 2 days. Order now and it can be ready on Tue 24 Nov", worked out in the browser from the ERP preparation time in Sri Lanka time (`lib/ready-time.ts`). Delivery slots come with BUN-251; checkout confirms the time.
- **Product details:** full description, item code, category, net weight, servings, the product's options (size, flavour …) and preparation time.
- **You may also like:** other products from the same category.

Until the ERP sends `short_description`, size photos, weight and servings (ticket BUN-257), the page uses the description for both texts and leaves the rest out.

### Search (BUN-172)

- **Where:** the header search box (every page) and `/search?q=…`, which uses the same sortable, paginated listing as category pages.
- **Suggestions while typing** (`components/layout/header/HeaderSearch.tsx`): after two letters, matching categories and up to six products (photo and price) appear, plus "See all results". ↓ ↑ and Enter pick one; Escape closes. The box is still a plain form, so Enter searches without JavaScript. Suggestions come from `GET /api/search/suggest?q=`, which answers in about 10–40 ms (no ERP call per keystroke); the box waits 120 ms after the last key.
- **How it matches** (`lib/search.ts`): search runs on the storefront over the cached list of visible products (`getAllProducts()`), so hidden products are never found. Every word typed must match, as a whole word, the start of a word ("choc"), or with a small typo (one letter wrong, missing, extra or swapped for 4–7 letters, two for longer words: "sausge", "birthdy cak"). Name matches rank first, then the item code, category name and description; ties go to featured, then popular products.
- **No results:** the page offers popular categories, ranked by their products' sales popularity (ERP order until the ERP sends popularity, BUN-256).
- **"No result" searches are counted for the team** in the `search_misses` table (normalised words, a count and first/last seen; nothing about who searched). The same query within 3 seconds counts once. Read them with:

```sh
curl -H "Authorization: Bearer $ORDERS_OPS_SECRET" "https://<site>/api/search/misses?days=30&limit=100"
```

### Missing images

A product with no image, an invalid image URL, or an image that fails to load shows a branded placeholder (the product's first letter) in the same square frame, so the page never breaks or jumps.

### Product visibility

Only products the business shows online appear on the storefront. The rules live in one place, `lib/erp/visibility.ts`:

- **Category:** shown when it is active, its "Show on the website" switch (`visible_online`) isn't off, and none of its parents are hidden.
- **Product:** shown when it is active, its switch isn't off, and its category is shown. Hiding a category hides everything in it.
- **SKU (size/variant):** hidden when inactive or switched off.

Until the ERP adds `visible_online` (contract question 7), `is_active` alone decides.

Where it applies:

- Every catalog read filters with these rules: category pages, the menus, home page sections, search and offers. The sitemap (BUN-221) will use the same reads.
- A hidden product's or category's URL is a **404**, the same as one that doesn't exist.
- **Cart:** nothing goes into the cart without a server check.
  - `POST /api/cart/items` asks the ERP **live** (no cache) and refuses a hidden product with a 404, even when called directly. The name and price stored in the cart come from that answer.
  - The cart page calls `POST /api/cart/validate` when it opens. It drops products hidden since they were added, shows a notice, and refreshes names and prices.
  - Checkout will run the same check (`lib/cart.server.ts`).

When something is hidden in the ERP, the ERP calls the revalidate webhook for that product or category. Product lists carry the `categories` tag too, so hiding a category also refreshes them.

### Pricing

The storefront never calculates a price. It shows and charges exactly what the ERP returns.

- **Pages** (cached, the same for every visitor) show the ERP's online price:
  - A product without sizes shows its price.
  - A product with sizes shows a size picker on the product page, with each size's own price. Sold-out sizes are disabled.
  - Product cards show "From" and the lowest size price when sizes are priced differently.
- **Cart and checkout** are priced on the server (`lib/cart.server.ts`, `priceCart()`), from a **live** ERP read with no cache:
  - The browser sends only product, size and quantity. Prices sent by the browser are ignored.
  - Line totals and the subtotal are calculated on the server, in cents.
  - The cart and checkout re-price whenever they open or a quantity changes (`useServerCart`). Hidden, sold-out or removed sizes are dropped with a notice.
- **Customer prices:** for a signed-in customer, the server asks the ERP for that customer's own prices (`?customer=`, from their customer group's price level). They are never cached or shown to anyone else. This is switched on once sign-in exists (`getCustomerId()`, BUN-186), and needs ERP ticket BUN-247.
- **Price changes:** the ERP calls the revalidate webhook for the product, and pages update. The cart picks up a new price straight away, because it reads live.
- **Placing an order** (BUN-164 / BUN-201) must call `priceCart()` again on the server, and the ERP re-prices the order itself (BUN-244).

### Offers (ERP schemes)

Discounts and promotions come from the ERP scheme engine. The storefront shows them, but never applies a discount itself.

- **Badges:**
  - Product cards and product pages show the offers that apply to the product, for example "Buy 2 get 1 free" or "10% off". These are schemes on the product, or on its category or a parent category (`lib/offers.ts`).
  - Whole-order offers, such as "LKR 500 off orders over LKR 10,000", aren't product badges.
  - A crossed-out price and "Save X%" are only shown while a scheme applies to the product (BUN-170). If the ERP sends a `compare_at_price` but no current scheme covers the product, the storefront ignores it and shows a plain price (`withSchemeBackedDiscounts()` in `lib/offers.ts`).
  - Customer-only schemes are never advertised.
- **Dates:**
  - `getActiveSchemes()` leaves out inactive and ended schemes. It is cached briefly (the `schemes` profile: refreshed every 5 minutes).
  - In the browser, `OfferBadges` also hides any offer outside its start and end time, minute by minute. A cached page can never show an expired offer, and a scheduled offer appears on time.
- **Cart and checkout:**
  - The server sends the cart to the ERP's `POST /prices/quote` (`lib/erp/quote.ts`), live and never cached. It shows exactly what the ERP returns:
    - each line's discount and which scheme gave it
    - order-level offers and free items
    - subtotal, discounts and total
  - The same evaluation applies to the order, so the cart matches what the customer is charged. An expired or inactive scheme is never applied.
- **Changes:** when a scheme is added, changed or ended, the ERP calls the revalidate webhook with `{"type":"schemes"}`. That refreshes the badges on every page.

The ERP doesn't have a general promotions engine yet (ticket BUN-248). The mock ERP has a small stand-in engine with test schemes: a buy-2-get-1 offer, a sausage bun special price (backs its crossed-out price), a 10% cake week, LKR 500 off over LKR 10,000, and ones that must never apply (expired, inactive, future, customer-only).

### Updates from the ERP

- **On a timer:** catalog pages refresh every 15 minutes.
- **Straight away:** the ERP calls `POST /api/revalidate`:

  | Change                                   | Body                           |
  | ---------------------------------------- | ------------------------------ |
  | A product is added or edited             | `{"type":"product","slug":…}`  |
  | A category is added, edited or reordered | `{"type":"category","slug":…}` |
  | A scheme / offer changes                 | `{"type":"schemes"}`           |
  | Everything                               | `{"type":"all"}`               |

### Mock ERP

`npm run mock:erp` starts a small fake ERP on `http://127.0.0.1:4010`. It implements the catalog endpoints from [docs/erp-api-contract.md](docs/erp-api-contract.md) with sample data, including a sub-category, a non-alphabetical order, a missing image, a broken image and a cake with four sizes (one sold out, one hidden). For the product card (BUN-170) it has a Cake Studio product ("Design your own cake"), a discounted product backed by a scheme (sausage bun) and a compare-at price with no scheme behind it (vegetable roll, shown at a plain price). For the product page (BUN-171), the fish bun has gallery photos (one broken), a short description, weight and servings, and the cake sizes have their own photos, weights and servings. `GET /images/gen/<label>.svg?bg=<hex>` draws a test photo. `?customer=cust-wholesale` returns a test customer's own prices. It also includes hidden items: an inactive category, a category and a product switched off for the website, and a visible product inside the hidden category.

To run the storefront against it, add this to `.env.local`:

```
ERP_API_BASE_URL=http://127.0.0.1:4010/api
ERP_API_KEY=mock-key
ERP_TENANT=buntalk
```

`POST /__mock/products` or `/__mock/categories` with a JSON body changes data. For orders, `GET /__mock/orders` lists what the storefront sent. `POST /__mock/fail` with `{"count":2,"status":503}` makes the next writes fail, to test the retry queue. That's how revalidation was tested:

- An edited product showed its new name and price after the webhook.
- A new product appeared in its category.
- Reordering categories in the "ERP" changed the order on the site.
