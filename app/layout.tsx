import type { Metadata, Viewport } from "next";
import { Baloo_2, Noto_Sans_Sinhala, Nunito } from "next/font/google";
import { brand } from "@/lib/brand";
import { publicEnv } from "@/lib/env";
import { Providers } from "./providers";
import "@/styles/globals.css";

// Body text: friendly rounded sans
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

// Headings: bold rounded display face that matches the logo lettering
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Sinhala text (tagline, future Sinhala content)
const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-sinhala",
  subsets: ["sinhala"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.backgroundLight },
    { media: "(prefers-color-scheme: dark)", color: brand.backgroundDark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${baloo.variable} ${notoSinhala.variable} h-full`}
    >
      <body className="min-h-full">
        {/* Header and footer come from the route group layouts:
            app/(site)/layout.tsx (full site) and app/(checkout)/layout.tsx (minimal). */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
