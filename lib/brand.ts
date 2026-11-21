/**
 * Brand values for places that cannot read CSS variables: the web app
 * manifest, the browser theme colour and social metadata.
 *
 * Colours here MUST match styles/tokens.css (orange-500 and sand-50/950).
 * Everywhere else, use the Tailwind tokens instead.
 */
export const brand = {
  name: "Buntalk",
  shortName: "Buntalk",
  description: "Buntalk online store",
  /** Sinhala tagline from the logo: "A world of tasty stories" */
  tagline: "රස කතා ලෝකයක්",
  themeColor: "#f38121", // --color-orange-500
  backgroundLight: "#fff9f6", // --color-sand-50
  backgroundDark: "#110a07", // --color-sand-950
  logo: {
    full: { src: "/brand/buntalk-logo.png", width: 990, height: 720 },
    compact: { src: "/brand/buntalk-logo-compact.png", width: 987, height: 556 },
  },
} as const;
