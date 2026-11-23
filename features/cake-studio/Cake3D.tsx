"use client";

import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { lookFor } from "@/lib/cake-studio/look";
import type { Menu } from "@/lib/cake-studio/design";
import type { CakeDesign } from "@/lib/erp";
import { cx } from "@/lib/utils";
import { CakePreview } from "./CakePreview";
import type { CakeGrab, CakeView } from "./scene/CakeScene";

/** three.js is loaded only in the browser, and only when the 3D view is shown. */
const CakeScene = lazy(() => import("./scene/CakeScene"));

let webgl: boolean | undefined;
/** Whether this browser can draw WebGL (checked once). */
function hasWebGL(): boolean {
  if (webgl === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}
const noSubscribe = () => () => {};

const VIEWS: { view: CakeView; label: string }[] = [
  { view: "front", label: "Front" },
  { view: "inside", label: "Inside" },
  { view: "top", label: "Top" },
];

/** A smaller copy of a PNG data URL (at most `max` pixels wide), to keep uploads light. */
export async function shrinkPng(dataUrl: string, max = 720): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  if (image.naturalWidth <= max) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = max;
  canvas.height = Math.round((image.naturalHeight * max) / image.naturalWidth);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/**
 * The live 3D preview of a design (BUN-182). Every option change redraws it
 * (the time from the change to the drawn frame is kept in
 * `data-update-ms`, for checking the ~200 ms budget). Drag or swipe to turn,
 * pinch or scroll to zoom, arrow keys too; Front / Inside / Top views and
 * Reset view. Without WebGL, and while three.js loads, the drawn 2D preview
 * shows instead.
 *
 * - `autoView`: the view that suits the open step (the slice for flavours);
 *   a view the customer picks wins until Reset view.
 * - `onPart`: a clicked part of the cake, as its designer step.
 * - `onGrab`: receives the function that gives a PNG of the cake.
 */
export function Cake3D({
  menu,
  design,
  autoView = "front",
  onPart,
  onGrab,
}: {
  menu: Menu;
  design: CakeDesign;
  autoView?: CakeView;
  onPart?: (part: number) => void;
  onGrab?: (grab: CakeGrab | null) => void;
}) {
  const supported = useSyncExternalStore(noSubscribe, hasWebGL, () => false);
  const [picked, setPicked] = useState<CakeView | null>(null);
  const [glow, setGlow] = useState(false);
  const [round, setRound] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const view = picked ?? autoView;
  const look = lookFor(menu, design, { view, spinning: !picked, glow });
  const key = JSON.stringify(look);

  // How long a change takes to show: from the render with the new look to the frame after it.
  useEffect(() => {
    const started = performance.now();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        box.current?.setAttribute(
          "data-update-ms",
          String(Math.round(performance.now() - started)),
        );
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);

  useEffect(() => () => onGrab?.(null), [onGrab]);

  if (!supported) {
    return (
      <div className="flex flex-col gap-2">
        <CakePreview menu={menu} design={design} />
        <p className="text-caption text-muted-foreground text-center">
          A drawing of your cake. The 3D view needs a browser with WebGL.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={box} data-cake-3d="" className="relative aspect-square w-full">
        <Suspense fallback={<CakePreview menu={menu} design={design} />}>
          <CakeScene key={round} look={look} onPart={onPart} onGrab={onGrab} />
        </Suspense>
      </div>
      <div
        className="flex flex-wrap items-center justify-center gap-2"
        role="group"
        aria-label="View"
      >
        {VIEWS.map((v) => (
          <button
            key={v.view}
            type="button"
            aria-pressed={view === v.view}
            onClick={() => setPicked(v.view)}
            className={cx(
              "text-body-sm rounded-full border px-3 py-1 font-semibold",
              view === v.view
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            {v.label}
          </button>
        ))}
        {look.candles > 0 && (
          <button
            type="button"
            aria-pressed={glow}
            onClick={() => setGlow(!glow)}
            className="border-border bg-surface hover:border-border-strong text-body-sm rounded-full border px-3 py-1 font-semibold"
          >
            {glow ? "Lights up" : "Light the candles"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setPicked(null);
            setGlow(false);
            setRound(round + 1);
          }}
          className="text-body-sm text-muted-foreground px-2 py-1 underline"
        >
          Reset view
        </button>
      </div>
      <p className="text-caption text-muted-foreground text-center">
        Drag to turn the cake, pinch or scroll to zoom. Tap a part to change it.
      </p>
    </div>
  );
}
