import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/brand";
import { TokenValue } from "./TokenValue";

/**
 * Style reference: every design token from styles/tokens.css, rendered live.
 * Values are read from the stylesheet, so this page can't drift from the tokens.
 */

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false, follow: false },
};

const palettes = [
  { name: "orange", label: "Orange — logo frame", brandStep: 500 },
  { name: "red", label: "Red-orange — “Bun”", brandStep: 500 },
  { name: "brown", label: "Brown — “Talk” and tagline", brandStep: 700 },
  { name: "sand", label: "Sand — warm neutral", brandStep: null },
];
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const semanticColors = [
  { name: "background", use: "Page background" },
  { name: "surface", use: "Cards, panels, inputs" },
  { name: "surface-muted", use: "Subtle sections, footer" },
  { name: "foreground", use: "Body text" },
  { name: "heading", use: "Headings, brand text" },
  { name: "muted-foreground", use: "Secondary text" },
  { name: "border", use: "Default borders" },
  { name: "border-strong", use: "Input borders" },
  { name: "primary", use: "Main buttons and links" },
  { name: "primary-hover", use: "Primary hover" },
  { name: "secondary", use: "Secondary buttons" },
  { name: "accent", use: "Brand highlight, badges" },
  { name: "accent-soft", use: "Soft brand background" },
  { name: "ring", use: "Keyboard focus outline" },
  { name: "success", use: "Success messages" },
  { name: "warning", use: "Warnings" },
  { name: "danger", use: "Errors, destructive actions" },
  { name: "info", use: "Information" },
];

const typeScale = [
  { token: "text-display", className: "font-display text-display text-heading font-bold" },
  { token: "text-h1", className: "font-display text-h1 text-heading font-bold" },
  { token: "text-h2", className: "font-display text-h2 text-heading font-bold" },
  { token: "text-h3", className: "font-display text-h3 text-heading font-bold" },
  { token: "text-h4", className: "font-display text-h4 text-heading font-bold" },
  { token: "text-body-lg", className: "text-body-lg" },
  { token: "text-body", className: "text-body" },
  { token: "text-body-sm", className: "text-body-sm" },
  { token: "text-caption", className: "text-caption" },
];

const spacingSteps = [1, 2, 3, 4, 6, 8, 10, 12, 16, 24];

const radii = [
  { token: "rounded-sm", className: "rounded-sm", use: "Inputs, small controls" },
  { token: "rounded-md", className: "rounded-md", use: "Buttons" },
  { token: "rounded-lg", className: "rounded-lg", use: "Cards" },
  { token: "rounded-xl", className: "rounded-xl", use: "Large panels" },
  { token: "rounded-full", className: "rounded-full", use: "Pills, avatars" },
  { token: "rounded-brand", className: "rounded-brand", use: "Logo frame shape" },
];

const shadows = [
  { token: "shadow-xs", className: "shadow-xs", use: "Resting cards" },
  { token: "shadow-sm", className: "shadow-sm", use: "Raised controls" },
  { token: "shadow-md", className: "shadow-md", use: "Hover, dropdowns" },
  { token: "shadow-lg", className: "shadow-lg", use: "Dialogs, popovers" },
];

const breakpoints = [
  { name: "(none)", min: "0", device: "Mobile (default, mobile first)" },
  { name: "sm:", min: "640px", device: "Large phones" },
  { name: "md:", min: "768px", device: "Tablets" },
  { name: "lg:", min: "1024px", device: "Desktop" },
  { name: "xl:", min: "1280px", device: "Wide desktop" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-5">
      <h2 className="text-h2 border-border border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="max-w-page mx-auto flex w-full flex-col gap-14 px-4 py-10 md:px-6 md:py-16">
      <header className="flex flex-col gap-3">
        <p className="text-caption text-primary font-bold tracking-wider uppercase">
          Design system
        </p>
        <h1 className="text-display">Buntalk style guide</h1>
        <p className="text-body-lg text-muted-foreground max-w-prose">
          Colours, type, spacing and brand assets. Everything here is read from{" "}
          <code className="font-mono">styles/tokens.css</code>, so it always matches what the site
          uses. Switch your system to dark mode to see the dark theme.
        </p>
        <nav aria-label="Sections" className="text-body-sm flex flex-wrap gap-x-4 gap-y-1">
          {[
            "brand",
            "colours",
            "typography",
            "spacing",
            "radius",
            "shadows",
            "breakpoints",
            "components",
          ].map((id) => (
            <a key={id} href={`#${id}`} className="text-primary capitalize underline">
              {id}
            </a>
          ))}
          <a href="/style-guide/components" className="text-primary font-bold underline">
            Component library →
          </a>
        </nav>
      </header>

      <Section id="brand" title="Brand">
        <div className="grid gap-4 md:grid-cols-3">
          <figure className="border-border bg-surface flex flex-col items-center gap-3 rounded-lg border p-6">
            <Logo variant="full" height={140} />
            <figcaption className="text-caption text-muted-foreground">
              Full logo with tagline — <code>variant=&quot;full&quot;</code>
            </figcaption>
          </figure>
          <figure className="border-border bg-surface flex flex-col items-center justify-between gap-3 rounded-lg border p-6">
            <Logo variant="compact" height={96} />
            <figcaption className="text-caption text-muted-foreground">
              Compact (header) — <code>variant=&quot;compact&quot;</code>
            </figcaption>
          </figure>
          <figure className="bg-sand-950 flex flex-col items-center justify-between gap-3 rounded-lg p-6">
            <Logo variant="compact" height={96} />
            <figcaption className="text-caption text-sand-300">On dark backgrounds</figcaption>
          </figure>
        </div>
        <p className="text-body-sm text-muted-foreground">
          Favicon and app icons: <code>app/icon.png</code>, <code>app/apple-icon.png</code>,{" "}
          <code>public/icons/</code> (192, 512, maskable). Social preview:{" "}
          <code>app/opengraph-image.png</code>. Tagline:{" "}
          <span lang="si" className="font-sinhala text-heading">
            {brand.tagline}
          </span>
        </p>
      </Section>

      <Section id="colours" title="Colours">
        <div className="flex flex-col gap-3">
          <h3 className="text-h4">Semantic tokens — use these in components</h3>
          <p className="text-body-sm text-muted-foreground">
            Use as <code>bg-*</code>, <code>text-*</code> or <code>border-*</code>, e.g.{" "}
            <code>bg-primary text-primary-foreground</code>. They switch automatically in dark mode.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {semanticColors.map((color) => (
              <li key={color.name} className="flex flex-col gap-1">
                <span
                  className="border-border h-14 rounded-md border"
                  style={{ backgroundColor: `var(--${color.name})` }}
                />
                <code className="text-body-sm font-mono font-bold">{color.name}</code>
                <TokenValue name={`--${color.name}`} />
                <span className="text-caption text-muted-foreground">{color.use}</span>
              </li>
            ))}
          </ul>
        </div>

        {palettes.map((palette) => (
          <div key={palette.name} className="flex flex-col gap-2">
            <h3 className="text-h4">{palette.label}</h3>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
              {steps.map((step) => (
                <li key={step} className="flex flex-col gap-1">
                  <span
                    className="border-border flex h-12 items-end rounded-md border p-1"
                    style={{ backgroundColor: `var(--color-${palette.name}-${step})` }}
                  >
                    {palette.brandStep === step && (
                      <span className="bg-surface text-caption text-foreground rounded-sm px-1 font-bold">
                        logo
                      </span>
                    )}
                  </span>
                  <code className="text-caption font-mono font-bold">
                    {palette.name}-{step}
                  </code>
                  <TokenValue name={`--color-${palette.name}-${step}`} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section id="typography" title="Typography">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border-border bg-surface rounded-lg border p-4">
            <p className="font-display text-h3 text-heading font-bold">Baloo 2</p>
            <p className="text-body-sm text-muted-foreground">
              Headings — <code>font-display</code>
            </p>
          </div>
          <div className="border-border bg-surface rounded-lg border p-4">
            <p className="text-h3 font-sans font-bold">Nunito</p>
            <p className="text-body-sm text-muted-foreground">
              Body text — <code>font-sans</code> (default)
            </p>
          </div>
          <div className="border-border bg-surface rounded-lg border p-4">
            <p lang="si" className="font-sinhala text-h3 font-bold">
              සිංහල අකුරු
            </p>
            <p className="text-body-sm text-muted-foreground">
              Noto Sans Sinhala — <code>font-sinhala</code>, also the fallback for Sinhala text
            </p>
          </div>
        </div>
        <ul className="flex flex-col gap-4">
          {typeScale.map((item) => (
            <li
              key={item.token}
              className="border-border flex flex-col gap-1 border-b pb-4 md:flex-row md:items-baseline md:gap-6"
            >
              <code className="text-caption text-muted-foreground w-32 shrink-0 font-mono">
                {item.token}
              </code>
              <span className={item.className}>Fresh buns, baked daily</span>
            </li>
          ))}
        </ul>
        <p className="text-body-sm text-muted-foreground">
          Headings (<code>h1</code>–<code>h4</code>) get the display font and heading colour
          automatically. Display and heading sizes scale smoothly between mobile and desktop.
        </p>
      </Section>

      <Section id="spacing" title="Spacing">
        <p className="text-body-sm text-muted-foreground">
          One unit is 4px. Use Tailwind&apos;s spacing utilities: <code>p-4</code> = 16px,{" "}
          <code>gap-6</code> = 24px, <code>mt-8</code> = 32px. Page content uses{" "}
          <code>max-w-page</code> (1152px), forms and text use <code>max-w-content</code> (768px)
          and <code>max-w-prose</code> (640px).
        </p>
        <ul className="flex flex-col gap-2">
          {spacingSteps.map((n) => (
            <li key={n} className="flex items-center gap-4">
              <code className="text-caption w-12 shrink-0 font-mono">{n}</code>
              <span
                className="bg-accent h-4 rounded-sm"
                style={{ width: `calc(var(--spacing) * ${n})` }}
              />
              <span className="text-caption text-muted-foreground">{n * 4}px</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="radius" title="Radius">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {radii.map((radius) => (
            <li key={radius.token} className="flex flex-col gap-2">
              <span className={`bg-accent-soft border-accent h-20 border-2 ${radius.className}`} />
              <code className="text-body-sm font-mono font-bold">{radius.token}</code>
              <span className="text-caption text-muted-foreground">{radius.use}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="shadows" title="Shadows">
        <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {shadows.map((shadow) => (
            <li
              key={shadow.token}
              className={`bg-surface flex h-24 flex-col justify-end rounded-lg p-3 ${shadow.className}`}
            >
              <code className="text-body-sm font-mono font-bold">{shadow.token}</code>
              <span className="text-caption text-muted-foreground">{shadow.use}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="breakpoints" title="Breakpoints">
        <p className="text-body-sm">
          Current screen:{" "}
          <strong className="text-primary">
            <span className="sm:hidden">Mobile</span>
            <span className="hidden sm:inline md:hidden">Large phone (sm)</span>
            <span className="hidden md:inline lg:hidden">Tablet (md)</span>
            <span className="hidden lg:inline xl:hidden">Desktop (lg)</span>
            <span className="hidden xl:inline">Wide desktop (xl)</span>
          </strong>
        </p>
        <table className="text-body-sm w-full text-left">
          <thead className="text-muted-foreground">
            <tr className="border-border border-b">
              <th className="py-2 pr-4 font-semibold">Prefix</th>
              <th className="py-2 pr-4 font-semibold">From width</th>
              <th className="py-2 font-semibold">Device</th>
            </tr>
          </thead>
          <tbody>
            {breakpoints.map((bp) => (
              <tr key={bp.name} className="border-border border-b">
                <td className="py-2 pr-4 font-mono">{bp.name}</td>
                <td className="py-2 pr-4">{bp.min}</td>
                <td className="py-2">{bp.device}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="components" title="Basic elements">
        <p className="text-body-sm text-muted-foreground">
          Examples of the tokens together. For the full component library with live examples, see{" "}
          <a href="/style-guide/components" className="text-primary font-bold underline">
            Components
          </a>
          .
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-5 py-2.5 font-bold"
          >
            Primary
          </button>
          <button
            type="button"
            className="bg-secondary text-secondary-foreground hover:bg-secondary-hover rounded-md px-5 py-2.5 font-bold"
          >
            Secondary
          </button>
          <button
            type="button"
            className="border-border-strong bg-surface text-foreground hover:bg-surface-muted rounded-md border px-5 py-2.5 font-bold"
          >
            Outline
          </button>
          <span className="border-accent bg-accent-soft text-accent-soft-foreground rounded-full border px-3 py-1 font-semibold">
            Category pill
          </span>
          <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 font-bold">
            New
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <p className="bg-success-soft text-success rounded-md p-3 font-semibold">Order placed</p>
          <p className="bg-warning-soft text-warning rounded-md p-3 font-semibold">Only 2 left</p>
          <p className="bg-danger-soft text-danger rounded-md p-3 font-semibold">Payment failed</p>
          <p className="bg-info-soft text-info rounded-md p-3 font-semibold">Delivery tomorrow</p>
        </div>
        <div className="rounded-brand border-accent bg-surface max-w-prose border-4 p-6">
          <h3 className="text-h3">Brand frame</h3>
          <p className="text-muted-foreground">
            <code>rounded-brand</code> echoes the logo&apos;s frame. Use it sparingly for
            highlights.
          </p>
        </div>
      </Section>
    </div>
  );
}
