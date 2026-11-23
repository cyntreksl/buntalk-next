"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Spinner } from "@/components/ui";
import type { Menu } from "@/lib/cake-studio/design";
import {
  startMode,
  tooSlow,
  WATCH_FRAMES,
  WHY_2D_TEXT,
  type DeviceSignals,
  type PreviewMode,
  type Why2d,
} from "@/lib/cake-studio/device";
import { lookFor } from "@/lib/cake-studio/look";
import type { CakeDesign } from "@/lib/erp";
import { cx } from "@/lib/utils";
import { CakePreview } from "./CakePreview";
import { drawingPicture } from "./drawingPicture";
import type { CakeGrab, CakeView } from "./scene/CakeScene";

/**
 * three.js is loaded only here: only on Cake Studio pages, only in the
 * browser, and only when the 3D view is shown (BUN-185).
 */
const CakeScene = lazy(() => import("./scene/CakeScene"));

/** Gives a PNG data URL of the cake as shown (3D, or the drawing), or null. */
export type CakePicture = () => string | null | Promise<string | null>;

const PREF_KEY = "buntalk:cake-studio:preview";
function savedMode(): PreviewMode | null {
  try {
    const value = window.localStorage.getItem(PREF_KEY);
    return value === "2d" || value === "3d" ? value : null;
  } catch {
    return null;
  }
}
function saveMode(mode: PreviewMode) {
  try {
    window.localStorage.setItem(PREF_KEY, mode);
  } catch {
    // Not kept: the next visit decides again.
  }
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function deviceSignals(): DeviceSignals {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return {
    webgl: hasWebGL(),
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory,
    saveData: nav.connection?.saveData,
    connection: nav.connection?.effectiveType,
  };
}

/** The starting preview, decided once per page load: "3d", or "2d:<why>". */
let decided: string | undefined;
const startSnapshot = () => {
  if (decided === undefined) {
    const start = startMode(deviceSignals(), savedMode());
    decided = start.why ? `2d:${start.why}` : "3d";
  }
  return decided;
};
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

/** The drawing, with a note on what is loading over it. */
function Loading({ menu, design, text }: { menu: Menu; design: CakeDesign; text: string }) {
  return (
    <div className="bg-accent-soft absolute inset-0">
      <CakePreview menu={menu} design={design} />
      <p
        role="status"
        className="bg-surface/90 text-body-sm absolute inset-x-0 bottom-2 mx-auto flex w-fit items-center gap-2 rounded-full px-3 py-1.5 font-semibold shadow-sm"
      >
        <Spinner size="sm" label={null} />
        {text}
      </p>
    </div>
  );
}

/**
 * The cake preview (BUN-182, BUN-185): the live 3D cake, or the drawn 2D cake
 * on browsers and devices that would struggle with 3D.
 *
 * - **Starting preview** (lib/cake-studio/device.ts): 3D, unless there's no
 *   WebGL, the connection saves data or is 2G, the device is very limited
 *   (2 cores or less, 1 GB memory or less), or the customer chose the drawing
 *   before. The server always renders the drawing; the browser decides.
 * - **Loading:** three.js loads only when the 3D view is shown. Until the 3D
 *   cake is drawn, the drawing shows with "Loading the 3D view…", then
 *   "Drawing your cake in 3D…".
 * - **Too slow:** if the first 60 frames of the 3D cake are slow (typical
 *   frame over 60 ms), it switches to the drawing and says why.
 * - **Choice:** "Show as a drawing" / "Show in 3D", remembered on this device.
 * - **3D controls:** drag or swipe to turn, pinch or scroll to zoom, arrow
 *   keys; Front / Inside / Top; Reset view. Every change redraws it (the time
 *   to the drawn frame is in `data-update-ms`, for the ~200 ms budget).
 * - `autoView`: the view that suits the open step; a view the customer picks
 *   wins until Reset view. `onPart`: a tapped part of the cake, as its step.
 * - `onGrab`: receives the function that gives a PNG of the cake as shown
 *   (the 3D cake, or the drawing), for the saved design.
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
  onGrab?: (grab: CakePicture | null) => void;
}) {
  const start = useSyncExternalStore(noSubscribe, startSnapshot, () => "server");
  const [choice, setChoice] = useState<{ mode: PreviewMode; why: Why2d | null } | null>(null);
  const [picked, setPicked] = useState<CakeView | null>(null);
  const [glow, setGlow] = useState(false);
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drawing = useRef<HTMLDivElement>(null);

  const decided: { mode: PreviewMode; why: Why2d | null } =
    choice ??
    (start === "server" || start === "3d"
      ? { mode: start === "3d" ? "3d" : "2d", why: null }
      : { mode: "2d", why: start.slice(3) as Why2d });
  const in3d = start !== "server" && decided.mode === "3d";
  const webgl = decided.why !== "no_webgl";
  // A 3D view the customer asked for isn't switched off for being slow.
  const watchSpeed = in3d && choice?.mode !== "3d" && savedMode() !== "3d";

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

  // The 3D scene hands over its picture function once its first frame is drawn.
  const sceneGrab = useCallback(
    (grab: CakeGrab | null) => {
      if (grab) setReady(true);
      onGrab?.(grab);
    },
    [onGrab],
  );

  // The drawing's picture, when the drawing is what's shown.
  useEffect(() => {
    if (in3d) return;
    onGrab?.(async () => {
      const svg = drawing.current?.querySelector("svg");
      return svg ? drawingPicture(svg) : null;
    });
  }, [in3d, onGrab]);
  useEffect(() => () => onGrab?.(null), [onGrab]);

  // Watch the first frames of the 3D cake: too slow on this device, show the drawing.
  useEffect(() => {
    if (!ready || !watchSpeed) return;
    const frames: number[] = [];
    let last = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      frames.push(now - last);
      last = now;
      if (frames.length < WATCH_FRAMES) {
        id = requestAnimationFrame(tick);
      } else if (tooSlow(frames.slice(5))) {
        saveMode("2d");
        setChoice({ mode: "2d", why: "too_slow" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [ready, watchSpeed]);

  const show = (mode: PreviewMode) => {
    saveMode(mode);
    setReady(false);
    setChoice({ mode, why: mode === "2d" ? "chosen" : null });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={box}
        data-cake-3d=""
        data-preview={in3d ? "3d" : "2d"}
        className="relative aspect-square w-full"
      >
        {in3d ? (
          <>
            <Suspense
              fallback={<Loading menu={menu} design={design} text="Loading the 3D view…" />}
            >
              <CakeScene key={round} look={look} onPart={onPart} onGrab={sceneGrab} />
              {!ready && <Loading menu={menu} design={design} text="Drawing your cake in 3D…" />}
            </Suspense>
          </>
        ) : (
          <div ref={drawing} className="flex size-full items-center">
            <CakePreview menu={menu} design={design} />
          </div>
        )}
      </div>

      {in3d ? (
        <>
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
                setReady(false);
                setRound(round + 1);
              }}
              className="text-body-sm text-muted-foreground px-2 py-1 underline"
            >
              Reset view
            </button>
          </div>
          <p className="text-caption text-muted-foreground text-center">
            Drag to turn the cake, pinch or scroll to zoom. Tap a part to change it.{" "}
            <button type="button" onClick={() => show("2d")} className="underline">
              Show as a drawing
            </button>
          </p>
        </>
      ) : (
        start !== "server" && (
          <p className="text-caption text-muted-foreground text-center">
            {WHY_2D_TEXT[decided.why ?? "chosen"]}{" "}
            {webgl && (
              <button
                type="button"
                onClick={() => show("3d")}
                className="text-primary font-semibold underline"
              >
                Show in 3D
              </button>
            )}
          </p>
        )
      )}
    </div>
  );
}
