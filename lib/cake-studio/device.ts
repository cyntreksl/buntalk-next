/**
 * Which cake preview to start with (BUN-185): the 3D view, or the drawn 2D
 * preview for browsers and devices that would struggle with it. Pure, so it
 * can be tested; Cake3D reads the browser's signals and calls it.
 */

export type PreviewMode = "3d" | "2d";

/** Why the preview is 2D: no WebGL, a budget device, a data-saving or slow connection, too slow in use, or the customer's choice. */
export type Why2d = "no_webgl" | "low_end" | "slow_connection" | "too_slow" | "chosen";

export type DeviceSignals = {
  webgl: boolean;
  /** navigator.hardwareConcurrency */
  cores?: number;
  /** navigator.deviceMemory, in GB (Chrome on Android; rounded down, 0.25–8). */
  memoryGb?: number;
  /** navigator.connection.saveData */
  saveData?: boolean;
  /** navigator.connection.effectiveType: "slow-2g" | "2g" | "3g" | "4g" */
  connection?: string;
};

/**
 * The preview to start with: 3D unless there's no WebGL, the customer chose
 * 2D before, or the device or connection is very limited (where three.js,
 * about 250 KB gzipped, would be slow to load or to draw). The customer can
 * still switch to 3D, except without WebGL.
 */
export function startMode(
  device: DeviceSignals,
  saved?: PreviewMode | null,
): { mode: PreviewMode; why: Why2d | null } {
  if (!device.webgl) return { mode: "2d", why: "no_webgl" };
  if (saved === "3d") return { mode: "3d", why: null };
  if (saved === "2d") return { mode: "2d", why: "chosen" };
  if (device.saveData || device.connection === "slow-2g" || device.connection === "2g") {
    return { mode: "2d", why: "slow_connection" };
  }
  if ((device.cores !== undefined && device.cores <= 2) || (device.memoryGb ?? 4) <= 1) {
    return { mode: "2d", why: "low_end" };
  }
  return { mode: "3d", why: null };
}

/** Frames to watch after the 3D cake first shows, and the frame time that counts as too slow. */
export const WATCH_FRAMES = 60;
export const SLOW_FRAME_MS = 60;

/**
 * Whether the 3D view is too slow to use: the typical (median) frame took
 * over 60 ms (under ~16 frames a second) across the frames watched.
 */
export function tooSlow(frameMs: number[]): boolean {
  if (frameMs.length < WATCH_FRAMES / 2) return false;
  const sorted = [...frameMs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] > SLOW_FRAME_MS;
}

/** What the customer is told when the cake is shown as a drawing. */
export const WHY_2D_TEXT: Record<Why2d, string> = {
  no_webgl: "A drawing of your cake: this browser can't show the 3D view.",
  low_end: "A drawing of your cake, to keep things quick on this device.",
  slow_connection: "A drawing of your cake, to save data on this connection.",
  too_slow: "The 3D view was slow on this device, so here is a drawing of your cake.",
  chosen: "A drawing of your cake.",
};
