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
  erp/            ERP API client and cached catalog reads (server only)
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
  - `Select`, `Checkbox` and `Radio` use the native inputs, so they work with phone pickers.
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

| Part       | Phone / tablet (below `lg`)                                                 | Desktop (`lg`+)                                                        |
| ---------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Navigation | ☰ button opens a drawer: search, categories, account links, cart, language | "All categories" mega-menu plus direct links to the first 6 categories |
| Search     | In the drawer                                                               | Search box in the header (a plain form to `/search`)                   |
| Cart       | Bag icon with item count                                                    | Same                                                                   |
| Account    | Person icon opens the account / sign-in menu                                | Same, with a "Sign in" or "Account" label at `xl`                      |
| Language   | In the drawer                                                               | Slot next to the account menu (switcher comes with BUN-211)            |

### How it works

- **Categories come from the ERP.** `SiteHeader` reads `getCategories()`, the cached ERP read from `lib/erp`. Nothing is hard-coded, and the `catalog` cache tag refreshes the menu with the rest of the catalog.
- **The header HTML is the same for every visitor**, so it can be cached with the page. Anything per-visitor is filled in in the browser:
  - **Cart count:** `CartButton` reads the cart store, so the count changes as soon as an item is added. The server always renders "Cart, empty".
  - **Signed-in state:** `AccountMenu` calls `GET /api/session` (never cached), which returns only `{ signedIn }`.
- **It stays at the top when scrolling.** The header uses `position: sticky` and gets a shadow once the page scrolls.
  - Its height is in `--header-height` (`styles/globals.css`).
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
