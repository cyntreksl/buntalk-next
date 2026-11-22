"use client";

import "@/styles/globals.css";
import { ErrorContent } from "@/components/feedback/ErrorContent";

/**
 * Last-resort error page, used only if the root layout itself fails. It
 * replaces the whole document, so it brings its own <html>, <body> and styles.
 * (Brand fonts load from the root layout, so system fonts are used here.)
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong | Buntalk</title>
        <main className="mx-auto flex min-h-dvh w-full max-w-(--container-content) flex-col justify-center px-4 py-10">
          <ErrorContent error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
