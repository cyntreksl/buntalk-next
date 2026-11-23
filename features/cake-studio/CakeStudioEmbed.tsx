"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card, Spinner, buttonClasses } from "@/components/ui";
import { readEmbedMessage, STOREFRONT_SOURCE, type EmbedMessage } from "@/lib/cake-studio/messages";
import { formatPrice } from "@/lib/utils";

/** No "ready" within this long: show the fallback. */
const LOAD_TIMEOUT_MS = 15_000;

type Saved = Extract<EmbedMessage, { type: "saved" }>;

/**
 * The ERP's Cake Studio inside the storefront (BUN-180, ERP ticket BUN-261),
 * under the storefront's own header and footer.
 *
 * - The iframe opens the ERP's embed page with a signed session (made on the
 *   server, see lib/cake-studio/embed.server.ts).
 * - Messages are accepted only from the ERP's origin and this iframe, and
 *   only in the agreed shapes (lib/cake-studio/messages.ts); messages to the
 *   embed go only to that origin, never "*".
 * - The frame grows with its content ("resize"), shows the live price
 *   ("design"), and when the customer saves a design ("saved") the storefront
 *   shows it with a link (adding it to the cart is BUN-184).
 * - If the embed doesn't answer within 15 seconds, a link to the menu is shown.
 */
export function CakeStudioEmbed({
  src,
  origin,
  sizeId,
  title = "Cake Studio",
}: {
  src: string;
  /** The ERP's origin, e.g. https://erp.example.com. */
  origin: string;
  /** Cake size to start with (also sent in the session). */
  sizeId?: number;
  title?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [height, setHeight] = useState(900);
  const [total, setTotal] = useState<number | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sends a message to the embed: only to the ERP's origin, never "*".
  const send = (message: Record<string, unknown>) =>
    frameRef.current?.contentWindow?.postMessage({ source: STOREFRONT_SOURCE, ...message }, origin);
  const greeted = useRef(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = readEmbedMessage(event, {
        origin,
        frame: frameRef.current?.contentWindow ?? null,
      });
      if (!message) return;
      // Any real message means the embed is up (its first "ready" can come before
      // this listener exists, which is why the frame's load also sends a "ping").
      setReady(true);
      setTimedOut(false);
      if (!greeted.current) {
        greeted.current = true;
        if (sizeId !== undefined) {
          frameRef.current?.contentWindow?.postMessage(
            { source: STOREFRONT_SOURCE, type: "preselect", size_id: sizeId },
            origin,
          );
        }
      }
      switch (message.type) {
        case "ready":
          break;
        case "resize":
          setHeight(message.height);
          break;
        case "design":
          setTotal(message.total);
          break;
        case "saved":
          setSaved(message);
          break;
        case "error":
          setError(message.message);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [origin, sizeId]);

  return (
    <div className="flex flex-col gap-4">
      {saved && (
        <Card role="status" className="bg-success-soft flex flex-col gap-2 border-0">
          <p className="text-success font-bold">
            Your design is saved ({formatPrice(saved.total, "LKR")}).
          </p>
          {saved.summary.length > 0 && (
            <p className="text-body-sm">{saved.summary.map((r) => r.value).join(" · ")}</p>
          )}
          <Link
            href={`/cake-studio?design=${encodeURIComponent(saved.design_id)}`}
            className="text-body-sm text-primary self-start font-bold underline-offset-4 hover:underline"
          >
            View your saved design (code {saved.design_id})
          </Link>
        </Card>
      )}
      {error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-md px-4 py-3 font-semibold">
          {error}
        </p>
      )}

      <div className="border-border bg-surface relative overflow-hidden rounded-2xl border">
        {!ready && !timedOut && (
          <div
            role="status"
            className="bg-surface absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
          >
            <Spinner size="lg" label={null} />
            <span className="text-muted-foreground">Opening Cake Studio…</span>
          </div>
        )}
        {timedOut && !ready && (
          <div className="bg-surface absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-bold">Cake Studio is taking too long to open.</p>
            <p className="text-muted-foreground">
              Please try again, or look through everything you can choose.
            </p>
            <Link href="/cake-studio?view=menu" className={buttonClasses({ variant: "outline" })}>
              See the Cake Studio menu
            </Link>
          </div>
        )}
        <iframe
          ref={frameRef}
          src={src}
          title={title}
          // The embed needs its own scripts and forms; nothing else (no top navigation, popups).
          sandbox="allow-scripts allow-same-origin allow-forms"
          allow="fullscreen"
          referrerPolicy="strict-origin"
          className="block w-full"
          style={{ height }}
          // Asks the embed to say "ready" again, in case it said so before we were listening.
          onLoad={() => send({ type: "ping" })}
        />
      </div>

      {total !== null && (
        <p className="text-body-sm text-muted-foreground" aria-live="polite">
          Current price: <strong className="text-foreground">{formatPrice(total, "LKR")}</strong>{" "}
          (from the ERP, for the design above).
        </p>
      )}
    </div>
  );
}
