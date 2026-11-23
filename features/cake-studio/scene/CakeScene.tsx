"use client";

/* eslint-disable no-restricted-syntax -- 3D materials need real colours, not CSS tokens */
/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect -- three.js objects
   are changed in place each frame; kept as in the ERP so the two scenes stay identical */
/**
 * The 3D cake (BUN-182), ported from the ERP's Cake Studio
 * (buntalk-erp-v2: resources/js/components/cake-studio/cake-scene.tsx) so a
 * cake looks the same in the ERP and the storefront. Keep the two in step:
 * copy changes across rather than editing only one.
 *
 * three.js + React Three Fiber. Drag to turn, pinch or scroll to zoom; front,
 * inside (slice) and top views; the message is drawn on the cake; `onGrab`
 * hands back a function that gives a PNG of the cake.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  WheelEvent,
} from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type {
  CakeFinishStyle,
  CakeLetteringStyle,
  CakeShapeModel,
  CakeTier,
  CakeToppingStyle,
} from "./types";

export type CakeView = "front" | "inside" | "top";

/** Everything the 3D cake shows: the picks the buyer made, as colours and styles. */
export type CakeLook = {
  model: CakeShapeModel;
  tiers: CakeTier[];
  frosting: string;
  /** The colour of each sponge layer in the slice, bottom first. */
  spongeLayers: string[];
  /** The filling colour between the layers, or null for none. */
  filling: string | null;
  finish: CakeFinishStyle;
  /** The drip colour when the finish is a drip. */
  drip: string | null;
  toppings: { style: CakeToppingStyle; colour: string | null }[];
  /** Candles on top, 0 for none. */
  candles: number;
  /** The number on the gold topper, or null. */
  topper: string | null;
  message: string;
  lettering: CakeLetteringStyle;
  writing: string;
  /** An object URL of the photo printed on top, or null. */
  photo: string | null;
  /** What the camera looks at: the whole cake, the slice, or the top. */
  view: CakeView;
  spinning: boolean;
  /** Lights down so the candles glow. */
  glow: boolean;
};

/** The step each part of the cake belongs to, for "click a part to edit it". */
export const PART_STEPS = {
  stand: 0,
  slice: 1,
  frosting: 2,
  toppings: 3,
  message: 4,
} as const;

/** Gives back a PNG data URL of the cake as it is now, on the stage colour. */
export type CakeGrab = () => string | null;

const STAND_TOP = 0.61;
const BACK = -Math.PI / 2;

type Point = { x: number; z: number };
type Placed = {
  x: number;
  y: number;
  z: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  color?: string;
};

/** Materials shared across rebuilds, keyed by colour and finish. */
const materials = new Map<string, THREE.Material>();

function standard(color: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  const key = `s${color}${roughness}${metalness}`;
  let material = materials.get(key) as THREE.MeshStandardMaterial | undefined;

  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
    });
    materials.set(key, material);
  }

  return material;
}

function glossy(): THREE.MeshPhysicalMaterial {
  let material = materials.get("stand") as THREE.MeshPhysicalMaterial | undefined;

  if (!material) {
    material = new THREE.MeshPhysicalMaterial({
      color: "#FFFFFF",
      roughness: 0.22,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
    materials.set("stand", material);
  }

  return material;
}

/** A seeded random so the cake looks the same on every rebuild. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: string, b: string, f: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), f).getHexString()}`;
}

/** The outline of one tier seen from above, `r` being half its width. */
function outlineShape(model: CakeShapeModel, r: number): THREE.Shape {
  const shape = new THREE.Shape();

  if (model === "square") {
    const a = r * 0.86;
    const c = r * 0.16;
    shape.moveTo(-a + c, -a);
    shape.lineTo(a - c, -a);
    shape.quadraticCurveTo(a, -a, a, -a + c);
    shape.lineTo(a, a - c);
    shape.quadraticCurveTo(a, a, a - c, a);
    shape.lineTo(-a + c, a);
    shape.quadraticCurveTo(-a, a, -a, a - c);
    shape.lineTo(-a, -a + c);
    shape.quadraticCurveTo(-a, -a, -a + c, -a);
  } else if (model === "heart") {
    const k = (2 * r * 1.04) / 110;
    const x = (value: number) => (value - 25) * k;
    const y = (value: number) => (47.5 - value) * k;
    shape.moveTo(x(25), y(25));
    shape.bezierCurveTo(x(25), y(25), x(20), y(0), x(0), y(0));
    shape.bezierCurveTo(x(-30), y(0), x(-30), y(35), x(-30), y(35));
    shape.bezierCurveTo(x(-30), y(55), x(-10), y(77), x(25), y(95));
    shape.bezierCurveTo(x(60), y(77), x(80), y(55), x(80), y(35));
    shape.bezierCurveTo(x(80), y(35), x(80), y(0), x(50), y(0));
    shape.bezierCurveTo(x(35), y(0), x(25), y(25), x(25), y(25));
  } else {
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
  }

  return shape;
}

/** The outline as points on the floor, for placing things along the edge. */
function outlinePoints(shape: THREE.Shape): Point[] {
  const points = shape.getSpacedPoints(120);
  const out: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    if (
      i === points.length - 1 &&
      Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y) < 1e-4
    ) {
      break;
    }

    out.push({ x: points[i].x, z: -points[i].y });
  }

  return out;
}

/** A solid tier with softly rounded edges standing on y = 0, with flat top and bottom normals. */
function solid(
  shape: THREE.Shape,
  height: number,
  bevel: number,
  offset: number,
): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: offset - bevel,
    bevelSegments: 5,
    curveSegments: 48,
  });
  geometry.deleteAttribute("uv");
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);

    if (Math.abs(y - height) < 1e-4) {
      normal.setXYZ(i, 0, 1, 0);
    } else if (Math.abs(y) < 1e-4) {
      normal.setXYZ(i, 0, -1, 0);
    }
  }

  normal.needsUpdate = true;

  return geometry;
}

/** Points spaced along the outline, pushed out by `offset` (inwards when negative). */
function along(
  outline: Point[],
  spacing: number,
  offset: number,
): (Point & { nx: number; nz: number })[] {
  const n = outline.length;
  const segments: number[] = [];
  let total = 0;

  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    segments.push(d);
    total += d;
  }

  const count = Math.max(6, Math.round(total / spacing));
  const step = total / count;
  const out: (Point & { nx: number; nz: number })[] = [];
  let i = 0;
  let acc = 0;

  for (let k = 0; k < count; k++) {
    const target = k * step;

    while (i < n - 1 && acc + segments[i] < target) {
      acc += segments[i];
      i++;
    }

    const a = outline[i];
    const b = outline[(i + 1) % n];
    const f = segments[i] > 0 ? Math.min(1, (target - acc) / segments[i]) : 0;
    const x = a.x + (b.x - a.x) * f;
    const z = a.z + (b.z - a.z) * f;
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    let nx = tz / tl;
    let nz = -tx / tl;

    if (nx * x + nz * z < 0) {
      nx = -nx;
      nz = -nz;
    }

    out.push({ x: x + nx * offset, z: z + nz * offset, nx, nz });
  }

  return out;
}

/** How far the outline reaches from the centre at angle `a`. */
function radial(outline: Point[], a: number): number {
  let best = 0;
  let bestDistance = 9;

  for (const point of outline) {
    let d = Math.abs(Math.atan2(point.z, point.x) - a) % (Math.PI * 2);

    if (d > Math.PI) {
      d = Math.PI * 2 - d;
    }

    if (d < bestDistance) {
      bestDistance = d;
      best = Math.hypot(point.x, point.z);
    }
  }

  return best;
}

function inPolygon(outline: Point[], x: number, z: number, scale: number): boolean {
  let inside = false;

  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const xi = outline[i].x * scale;
    const zi = outline[i].z * scale;
    const xj = outline[j].x * scale;
    const zj = outline[j].z * scale;

    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  list: Placed[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
  const dummy = new THREE.Object3D();
  const colour = new THREE.Color();

  list.forEach((item, i) => {
    dummy.position.set(item.x, item.y, item.z);
    dummy.rotation.set(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0);
    dummy.scale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    if (item.color) {
      colour.set(item.color);
      mesh.setColorAt(i, colour);
    }
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    if (mesh.userData.ownMaterial) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.map?.dispose();
      material.dispose();
    }
  });
}

const SCRIPT_FONT = "'Pacifico', 'Noto Sans Sinhala', cursive";
const BOLD_FONT = "'Bricolage Grotesque', 'Noto Sans Sinhala', system-ui, sans-serif";

function fitText(
  context: CanvasRenderingContext2D,
  lines: string[],
  weight: string,
  family: string,
  start: number,
  maxWidth: number,
): number {
  let size = start;
  const fits = () => {
    context.font = `${weight}${size}px ${family}`;

    return Math.max(...lines.map((line) => context.measureText(line).width)) <= maxWidth;
  };

  while (size > 40 && !fits()) {
    size -= 6;
  }

  return size;
}

/** The message, and the photo when there is one, drawn flat on the top of the cake. */
function topTexture(
  message: string,
  colour: string,
  lettering: CakeLetteringStyle,
  photo: HTMLImageElement | null,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = photo ? 1024 : 512;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  const family = lettering === "bold" ? BOLD_FONT : SCRIPT_FONT;
  const weight = lettering === "bold" ? "800 " : "";
  context.textAlign = "center";
  context.textBaseline = "middle";

  if (photo) {
    context.save();
    context.beginPath();
    context.arc(512, 512, 470, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    const width = photo.naturalWidth || photo.width;
    const height = photo.naturalHeight || photo.height;
    const scale = Math.max(940 / width, 940 / height);
    context.drawImage(
      photo,
      512 - (width * scale) / 2,
      512 - (height * scale) / 2,
      width * scale,
      height * scale,
    );

    if (message) {
      context.fillStyle = "rgba(255, 248, 236, 0.94)";
      context.fillRect(0, 668, 1024, 170);
    }

    context.restore();
    context.lineWidth = 16;
    context.strokeStyle = "#FFF8EC";
    context.beginPath();
    context.arc(512, 512, 470, 0, Math.PI * 2);
    context.stroke();

    if (message) {
      const size = fitText(context, [message], weight, family, 110, 640);
      context.font = `${weight}${size}px ${family}`;
      context.fillStyle = colour.toUpperCase() === "#FFFFFF" ? "#4A2A1A" : colour;
      context.fillText(message, 512, 753);
    }
  } else {
    let lines = [message];

    if (message.length > 13 && message.includes(" ")) {
      const words = message.split(" ");
      let best = 1;
      let bestDifference = Number.POSITIVE_INFINITY;

      for (let i = 1; i < words.length; i++) {
        const difference = Math.abs(
          words.slice(0, i).join(" ").length - words.slice(i).join(" ").length,
        );

        if (difference < bestDifference) {
          bestDifference = difference;
          best = i;
        }
      }

      lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
    }

    const size = fitText(context, lines, weight, family, lines.length > 1 ? 170 : 210, 930);
    context.font = `${weight}${size}px ${family}`;
    const lineHeight = size * 1.12;
    const y0 = 256 - ((lines.length - 1) * lineHeight) / 2;
    context.fillStyle = "rgba(40, 20, 10, 0.22)";
    lines.forEach((line, i) => context.fillText(line, 512, y0 + i * lineHeight + size * 0.035));
    context.fillStyle = colour;
    lines.forEach((line, i) => context.fillText(line, 512, y0 + i * lineHeight));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
}

/** The gold number for the topper. */
function numberTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256 * text.length + 96;
  canvas.height = 448;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 400px ${BOLD_FONT}`;
  context.lineJoin = "round";
  context.lineWidth = 26;
  context.strokeStyle = "#A9781C";
  context.strokeText(text, canvas.width / 2, 236);
  context.fillStyle = "#E8BE55";
  context.fillText(text, canvas.width / 2, 236);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
}

type Built = {
  group: THREE.Group;
  flames: THREE.Mesh[];
  /** The top of the cake body, where the camera looks for the top view. */
  bodyTop: number;
  /** The top of everything, topper and candles included. */
  cakeTop: number;
  radius: number;
};

/** Builds the stand, the cake and everything on it from the look. */
function buildCake(look: CakeLook, photo: HTMLImageElement | null): Built {
  const group = new THREE.Group();
  const flames: THREE.Mesh[] = [];
  const random = seeded(7);
  const tiers = look.tiers.map((tier) => {
    const r = tier.width / 2;
    const shape = outlineShape(look.model, r);

    return { r, h: tier.height, shape, outline: outlinePoints(shape) };
  });
  let maxR = 0;
  tiers[0].outline.forEach((point) => {
    maxR = Math.max(maxR, Math.hypot(point.x, point.z));
  });

  // The stand and the board.
  const standR = maxR + 0.3;
  const profile = [
    [0, 0],
    [0.62, 0],
    [0.66, 0.025],
    [0.62, 0.05],
    [0.3, 0.09],
    [0.14, 0.2],
    [0.11, 0.36],
    [0.16, 0.47],
    [standR * 0.6, 0.53],
    [standR, 0.56],
    [standR + 0.02, 0.585],
    [standR, STAND_TOP],
    [0, STAND_TOP],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const stand = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), glossy());
  stand.castShadow = true;
  stand.receiveShadow = true;
  stand.userData.step = PART_STEPS.stand;
  group.add(stand);
  const board = new THREE.Mesh(
    new THREE.CylinderGeometry(maxR + 0.1, maxR + 0.1, 0.03, 72),
    standard("#E7D3A1", 0.5, 0.35),
  );
  board.position.y = STAND_TOP + 0.015;
  board.castShadow = true;
  board.receiveShadow = true;
  board.userData.step = PART_STEPS.stand;
  group.add(board);

  const creamColour = look.frosting.toUpperCase() === "#FFFAF0" ? "#F3DFC2" : "#FFF8EC";
  const dripColour = look.drip ?? "#4A2A1A";
  const topIndex = tiers.length - 1;
  const hasPearls = look.toppings.some((topping) => topping.style === "pearls");
  const hasSprinkles = look.toppings.some((topping) => topping.style === "sprinkles");
  let y = STAND_TOP + 0.03;

  tiers.forEach((tier, index) => {
    const tierGroup = new THREE.Group();
    tierGroup.position.y = y;
    tierGroup.userData.step = PART_STEPS.frosting;
    const tierColour =
      look.finish === "ombre" && topIndex > 0
        ? mix(look.frosting, "#FFFFFF", (index / topIndex) * 0.7)
        : look.finish === "ombre"
          ? mix(look.frosting, "#FFFFFF", 0.25)
          : look.frosting;
    const body = new THREE.Mesh(solid(tier.shape, tier.h, 0.05, 0), standard(tierColour, 0.62));
    body.castShadow = true;
    body.receiveShadow = true;
    tierGroup.add(body);
    let topY = tier.h;
    const upper = tiers[index + 1] ?? null;

    if (look.finish === "drip") {
      const glaze = new THREE.Mesh(
        solid(tier.shape, 0.05, 0.022, 0.014),
        standard(dripColour, 0.22),
      );
      glaze.position.y = tier.h - 0.028;
      glaze.castShadow = true;
      tierGroup.add(glaze);
      topY = tier.h + 0.022;
      const cylinders: Placed[] = [];
      const balls: Placed[] = [];
      along(tier.outline, 0.2, 0.012).forEach((point) => {
        const length = 0.1 + random() * 0.34;
        cylinders.push({
          x: point.x,
          y: tier.h - length / 2,
          z: point.z,
          sy: length,
        });
        balls.push({ x: point.x, y: tier.h - length, z: point.z });
      });
      tierGroup.add(
        instanced(
          new THREE.CylinderGeometry(0.036, 0.036, 1, 10),
          standard(dripColour, 0.22),
          cylinders,
        ),
      );
      tierGroup.add(
        instanced(new THREE.SphereGeometry(0.036, 12, 10), standard(dripColour, 0.22), balls),
      );
    }

    if (look.finish === "piped") {
      const top = along(tier.outline, 0.125, -0.075).map((point) => ({
        x: point.x,
        y: tier.h + 0.03,
        z: point.z,
        sy: 0.9,
      }));
      tierGroup.add(
        instanced(new THREE.SphereGeometry(0.06, 14, 10), standard(creamColour, 0.7), top),
      );

      if (!hasPearls) {
        const bottom = along(tier.outline, 0.125, 0.03).map((point) => ({
          x: point.x,
          y: 0.045,
          z: point.z,
          sy: 0.9,
        }));
        tierGroup.add(
          instanced(new THREE.SphereGeometry(0.06, 14, 10), standard(creamColour, 0.7), bottom),
        );
      }
    }

    if (hasPearls) {
      const pearls = along(tier.outline, 0.085, 0.028).map((point) => ({
        x: point.x,
        y: 0.036,
        z: point.z,
      }));
      const pearlMesh = instanced(
        new THREE.SphereGeometry(0.036, 14, 10),
        standard("#E2B955", 0.24, 1),
        pearls,
      );
      pearlMesh.userData.step = PART_STEPS.toppings;
      tierGroup.add(pearlMesh);
    }

    if (hasSprinkles) {
      const colours = ["#E63946", "#3B82C4", "#F4A300", "#4CAF6A", "#FFFFFF", "#B8174C"];
      const list: Placed[] = [];
      const want = index === topIndex ? 110 : 80;
      const keepCentre = index === topIndex && (look.message !== "" || look.photo !== null);
      let guard = 0;

      while (list.length < want && guard < 4000) {
        guard++;
        const x = (random() * 2 - 1) * tier.r * 1.1;
        const z = (random() * 2 - 1) * tier.r * 1.1;

        if (!inPolygon(tier.outline, x, z, 0.9)) {
          continue;
        }

        if (upper && inPolygon(upper.outline, x, z, 1.1)) {
          continue;
        }

        if (
          keepCentre &&
          (look.photo
            ? Math.hypot(x, z) < tier.r * 0.62
            : Math.abs(x) < tier.r * 0.56 && Math.abs(z) < tier.r * 0.3)
        ) {
          continue;
        }

        list.push({
          x,
          y: topY + 0.012,
          z,
          rx: Math.PI / 2,
          rz: random() * Math.PI,
          color: colours[Math.floor(random() * colours.length)],
        });
      }

      const sprinkleMesh = instanced(
        new THREE.CapsuleGeometry(0.012, 0.045, 3, 6),
        standard("#FFFFFF", 0.45),
        list,
      );
      sprinkleMesh.userData.step = PART_STEPS.toppings;
      tierGroup.add(sprinkleMesh);
    }

    if (index === topIndex) {
      decorateTop(tierGroup, tier, topY, look, photo, flames);
    }

    group.add(tierGroup);
    y += tier.h;
  });

  return {
    group,
    flames,
    bodyTop: y,
    cakeTop: y + (look.topper ? 0.95 : look.candles > 0 ? 0.4 : 0),
    radius: maxR,
  };
}

function decorateTop(
  group: THREE.Group,
  tier: { r: number; outline: Point[] },
  topY: number,
  look: CakeLook,
  photo: HTMLImageElement | null,
  flames: THREE.Mesh[],
): void {
  const reach = (a: number, f: number) => radial(tier.outline, a) * f;
  const heart = look.model === "heart";
  const rmin = heart ? tier.r * 0.62 : look.model === "square" ? tier.r * 0.86 : tier.r;
  const hasTopper = look.topper !== null;
  const has = (style: CakeToppingStyle) => look.toppings.find((topping) => topping.style === style);
  const pieces = look.toppings.filter((topping) => topping.style === "pieces");

  if (has("fruit")) {
    const fruit = new THREE.Group();
    const berry = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.058, 0],
        [0.07, 0.04],
        [0.058, 0.09],
        [0.032, 0.132],
        [0, 0.15],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      16,
    );
    const blue = new THREE.SphereGeometry(0.04, 14, 10);
    const n = 12;

    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.26;
      let fromBack = Math.abs(a - (BACK + Math.PI * 2)) % (Math.PI * 2);

      if (fromBack > Math.PI) {
        fromBack = Math.PI * 2 - fromBack;
      }

      if (has("macarons") && fromBack < 1.0) {
        continue;
      }

      const rr = reach(a, 0.74);

      if (i % 2 === 0) {
        const strawberry = new THREE.Mesh(berry, standard("#D7263D", 0.42));
        strawberry.position.set(Math.cos(a) * rr, topY, Math.sin(a) * rr);
        strawberry.rotation.set(0.12, a, 0.1);
        strawberry.castShadow = true;
        fruit.add(strawberry);
      } else {
        [-0.05, 0.05].forEach((offset, k) => {
          const blueberry = new THREE.Mesh(blue, standard("#2F2C6E", 0.5));
          blueberry.position.set(
            Math.cos(a + offset / rr) * (rr + k * 0.03),
            topY + 0.036,
            Math.sin(a + offset / rr) * (rr + k * 0.03),
          );
          blueberry.castShadow = true;
          fruit.add(blueberry);
        });
      }
    }

    fruit.userData.step = PART_STEPS.toppings;
    group.add(fruit);
  }

  if (has("macarons")) {
    const macarons = new THREE.Group();
    const colours = ["#F6B7C8", "#BFD8A0", "#F8E08E", "#CDB7E9", "#F7C4A2"];
    const shell = new THREE.SphereGeometry(0.09, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const fill = new THREE.CylinderGeometry(0.082, 0.082, 0.026, 18);

    for (let k = -2; k <= 2; k++) {
      if (heart && k === 0) {
        continue;
      }

      const a = BACK + k * (heart ? 0.46 : 0.36);
      const rr = reach(a, 0.72);
      const one = new THREE.Group();
      const shellMaterial = standard(colours[k + 2], 0.55);
      const top = new THREE.Mesh(shell, shellMaterial);
      top.scale.y = 0.5;
      top.position.y = 0.013;
      const bottom = new THREE.Mesh(shell, shellMaterial);
      bottom.scale.y = 0.5;
      bottom.rotation.x = Math.PI;
      bottom.position.y = -0.013;
      const middle = new THREE.Mesh(fill, standard("#FFF8EC", 0.7));
      one.add(top, bottom, middle);
      one.traverse((object) => {
        object.castShadow = true;
      });
      one.position.set(Math.cos(a) * rr, topY + 0.085, Math.sin(a) * rr);
      one.rotation.set(0.95, -a + Math.PI / 2, 0, "YXZ");
      macarons.add(one);
    }

    macarons.userData.step = PART_STEPS.toppings;
    group.add(macarons);
  }

  if (has("flowers")) {
    const flowers = new THREE.Group();
    const petal = new THREE.SphereGeometry(0.075, 12, 8);
    const centre = new THREE.SphereGeometry(0.04, 10, 8);
    const own = has("flowers")?.colour ?? "#B8174C";
    const colours = [own, "#FFFFFF", mix(own, "#FFFFFF", 0.5)];
    const n = heart ? 5 : 6;

    for (let i = 0; i < n; i++) {
      const a = BACK + Math.PI + ((i - (n - 1) / 2) / n) * Math.PI * 1.1;
      const rr = reach(a, 0.7);
      const flower = new THREE.Group();
      const material = standard(colours[i % colours.length], 0.6);

      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        const mesh = new THREE.Mesh(petal, material);
        mesh.position.set(Math.cos(pa) * 0.085, 0.035, Math.sin(pa) * 0.085);
        mesh.scale.set(1, 0.5, 1);
        mesh.castShadow = true;
        flower.add(mesh);
      }

      const middle = new THREE.Mesh(centre, standard("#F2D488", 0.5));
      middle.position.y = 0.055;
      flower.add(middle);
      flower.position.set(Math.cos(a) * rr, topY, Math.sin(a) * rr);
      flowers.add(flower);
    }

    flowers.userData.step = PART_STEPS.toppings;
    group.add(flowers);
  }

  if (pieces.length > 0) {
    const list: Placed[] = [];
    pieces.forEach((piece, kind) => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + kind * 0.5 + 0.1;
        const rr = reach(a, 0.6 - kind * 0.1);
        list.push({
          x: Math.cos(a) * rr,
          y: topY + 0.045,
          z: Math.sin(a) * rr,
          color: piece.colour ?? "#B8174C",
        });
      }
    });
    const pieceMesh = instanced(
      new THREE.SphereGeometry(0.05, 14, 12),
      standard("#FFFFFF", 0.4),
      list,
    );
    pieceMesh.userData.step = PART_STEPS.toppings;
    group.add(pieceMesh);
  }

  if (look.candles > 0) {
    const candles = new THREE.Group();
    const colours = ["#FFFFFF", "#FBDD7E", "#F7B6C8", "#B5DAF2", "#BFE3C6"];
    const stick = new THREE.CylinderGeometry(0.022, 0.022, 0.36, 10);
    const flameGeometry = new THREE.SphereGeometry(0.03, 10, 10);
    const n = Math.max(1, Math.min(12, look.candles));
    const rows = n > 9 ? 2 : 1;

    for (let k = 0; k < n; k++) {
      const row = rows === 2 && k >= Math.ceil(n / 2) ? 1 : 0;
      const inRow = rows === 2 ? (row === 0 ? Math.ceil(n / 2) : n - Math.ceil(n / 2)) : n;
      const indexInRow = row === 0 ? k : k - Math.ceil(n / 2);
      const gap = Math.min(0.42, 2.7 / Math.max(1, inRow - 1));
      const a = BACK + (indexInRow - (inRow - 1) / 2) * gap;
      const rr = rmin * (row === 0 ? 0.54 : 0.28);
      const one = new THREE.Group();
      const candle = new THREE.Mesh(stick, standard(colours[k % colours.length], 0.5));
      candle.position.y = 0.18;
      candle.castShadow = true;
      const flame = new THREE.Mesh(
        flameGeometry,
        new THREE.MeshBasicMaterial({
          color: "#FFB21F",
          toneMapped: false,
        }),
      );
      flame.userData.ownMaterial = true;
      flame.scale.set(0.75, 1.6, 0.75);
      flame.position.y = 0.42;
      one.add(candle, flame);
      one.position.set(Math.cos(a) * rr, topY, Math.sin(a) * rr);
      candles.add(one);
      flames.push(flame);
    }

    candles.userData.step = PART_STEPS.toppings;
    group.add(candles);
  }

  if (look.topper) {
    const text = look.topper.slice(0, 3);
    const topper = new THREE.Group();
    const width = 0.3 * text.length + 0.12;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 0.5),
      new THREE.MeshStandardMaterial({
        map: numberTexture(text),
        transparent: true,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
        roughness: 0.3,
        metalness: 0.55,
      }),
    );
    plane.userData.ownMaterial = true;
    plane.position.y = 0.6;
    plane.castShadow = true;
    topper.add(plane);
    [-1, 1].forEach((side) => {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.42, 8),
        standard("#E2B955", 0.3, 1),
      );
      stick.position.set(side * width * 0.22, 0.2, -0.004);
      topper.add(stick);
    });
    topper.position.set(0, topY, -rmin * 0.2);
    topper.userData.step = PART_STEPS.toppings;
    group.add(topper);
  }

  if (look.message !== "" || photo) {
    const texture = topTexture(look.message, look.writing, look.lettering, photo);
    const width = photo ? rmin * 1.2 : rmin * 1.36;
    const crowded = look.candles > 0 || has("macarons") !== undefined || hasTopper;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, photo ? width : width / 2),
      new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        roughness: 0.5,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    plane.userData.ownMaterial = true;
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, topY + 0.006, photo ? 0 : crowded ? rmin * 0.14 : 0);
    plane.renderOrder = 2;
    plane.userData.step = PART_STEPS.message;
    group.add(plane);
  }
}

/** A slice on a plate, showing the sponge layers, the filling and the frosting. */
function buildSlice(look: CakeLook): THREE.Group {
  const slice = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 0.05, 48), glossy());
  plate.position.y = 0.025;
  plate.receiveShadow = true;
  plate.castShadow = true;
  slice.add(plate);
  const wedge = new THREE.Group();
  wedge.position.set(-0.25, 0.05, -0.45);
  const R = 1.15;
  const a0 = 0;
  const arc = 0.6;
  const layers = look.spongeLayers.length > 0 ? look.spongeLayers : ["#F2D488"];
  const shown = [0, 1, 2].map((i) => layers[Math.min(i, layers.length - 1)]);
  const layer = (y0: number, h: number, colour: string, roughness: number) => {
    const key = `d${colour}${roughness}`;
    let material = materials.get(key) as THREE.MeshStandardMaterial | undefined;

    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: colour,
        roughness,
        side: THREE.DoubleSide,
      });
      materials.set(key, material);
    }

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, h, 20, 1, false, a0, arc),
      material,
    );
    body.position.y = y0 + h / 2;
    body.castShadow = true;
    wedge.add(body);
    [a0, a0 + arc].forEach((a) => {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(R, h), material);
      face.geometry.translate(R / 2, 0, 0);
      face.rotation.y = a - Math.PI / 2;
      face.position.y = y0 + h / 2;
      face.castShadow = true;
      wedge.add(face);
    });
  };
  let y = 0;
  shown.forEach((colour, i) => {
    layer(y, 0.2, colour, 0.95);
    y += 0.2;

    if (i < 2) {
      layer(y, 0.045, look.filling ?? mix(look.frosting, "#FFFFFF", 0.4), 0.6);
      y += 0.045;
    }
  });
  layer(y, 0.045, look.frosting, 0.62);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.035, R + 0.035, y + 0.045, 20, 1, true, a0, arc),
    standard(look.frosting, 0.62),
  );
  shell.position.y = (y + 0.045) / 2;
  shell.castShadow = true;
  wedge.add(shell);
  slice.add(wedge);
  slice.userData.step = PART_STEPS.slice;
  slice.position.set(2.25, 0, 1.75);
  slice.rotation.y = -1.9;

  return slice;
}

/** The buyer's turning, tilting and zooming, shared between the pointer handlers and the frames. */
type Hand = {
  yaw: number;
  velocity: number;
  tilt: number;
  zoom: number;
  idleAt: number;
  dragging: boolean;
  pointers: Map<number, { x: number; y: number }>;
  last: { x: number; y: number };
  pinch: number;
};

function Scene({
  look,
  photo,
  hand,
  onPart,
  onGrab,
}: {
  look: CakeLook;
  photo: HTMLImageElement | null;
  hand: MutableRefObject<Hand>;
  onPart?: (step: number) => void;
  onGrab?: (grab: CakeGrab) => void;
}) {
  const { gl, scene, camera } = useThree();
  const turn = useRef<THREE.Group>(null);
  const sliceRef = useRef<THREE.Group>(null);
  const flameLight = useRef<THREE.PointLight>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const skyLight = useRef<THREE.HemisphereLight>(null);
  const floor = useRef<THREE.MeshStandardMaterial>(null);
  const dim = useRef(0);
  const floorColour = useMemo(
    () => ({
      day: new THREE.Color("#FFF7E0"),
      night: new THREE.Color("#3A2418"),
    }),
    [],
  );

  useEffect(() => {
    onGrab?.(() => {
      gl.render(scene, camera);
      const source = gl.domElement;
      const out = document.createElement("canvas");
      out.width = source.width;
      out.height = source.height;
      const context = out.getContext("2d");

      if (!context) {
        return null;
      }

      context.fillStyle = look.glow ? "#20120C" : "#FFEBAD";
      context.fillRect(0, 0, out.width, out.height);
      context.drawImage(source, 0, 0);

      return out.toDataURL("image/png");
    });
  }, [onGrab, gl, scene, camera, look.glow]);

  const partClicked = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 6 || !onPart) {
      return;
    }

    let object: THREE.Object3D | null = event.object;

    while (object && object.userData.step === undefined) {
      object = object.parent;
    }

    if (object) {
      event.stopPropagation();
      onPart(object.userData.step as number);
    }
  };
  const built = useMemo(() => buildCake(look, photo), [look, photo]);
  const slice = useMemo(() => buildSlice(look), [look]);
  const cameraState = useRef({
    az: 0,
    el: 0.3,
    dist: 9,
    tx: 0,
    ty: 1.2,
    tz: 0,
  });
  const sliceScale = useRef(0.001);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.75;

    return () => {
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useEffect(() => () => disposeGroup(built.group), [built]);
  useEffect(() => () => disposeGroup(slice), [slice]);

  useFrame((state, delta) => {
    const dt = Math.min(0.05, delta);
    const now = performance.now();
    const h = hand.current;
    const aspect = (camera as THREE.PerspectiveCamera).aspect || 1;
    const half = Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
    const top = built.cakeTop;
    const R = built.radius;
    const fitH = (top + 0.75) / 2 / half;
    const fitW = (R + 0.75) / (half * aspect);
    const base = Math.max(fitH, fitW) * 1.5;
    const target =
      look.view === "top"
        ? {
            az: 0,
            el: 1.0,
            dist: Math.max((R + 0.5) / half, (R + 0.5) / (half * aspect)) * 1.08 * h.zoom,
            tx: 0,
            ty: built.bodyTop - 0.1,
            tz: 0,
          }
        : look.view === "inside"
          ? {
              az: 0.5,
              el: 0.36,
              dist: (aspect < 1 ? (5.4 / aspect) * 0.78 : 5.4) * h.zoom,
              tx: 2.0,
              ty: 0.45,
              tz: 1.55,
            }
          : {
              az: 0,
              el: 0.3 + h.tilt,
              dist: base * h.zoom,
              tx: 0,
              ty: top * 0.45,
              tz: 0,
            };
    const k = 1 - Math.exp(-dt * 4.5);
    const c = cameraState.current;
    (Object.keys(target) as (keyof typeof target)[]).forEach((key) => {
      c[key] += (target[key] - c[key]) * k;
    });
    camera.position.set(
      c.tx + c.dist * Math.sin(c.az) * Math.cos(c.el),
      c.ty + c.dist * Math.sin(c.el),
      c.tz + c.dist * Math.cos(c.az) * Math.cos(c.el),
    );
    camera.lookAt(c.tx, c.ty, c.tz);

    if (look.view === "front") {
      if (!h.dragging) {
        if (Math.abs(h.velocity) > 0.02) {
          h.yaw += h.velocity * dt;
          h.velocity *= Math.exp(-dt * 3);
        } else if (look.spinning && now - h.idleAt > 2200) {
          h.yaw += dt * 0.22;
        }
      }
    } else {
      const two = Math.PI * 2;
      const goal = Math.round(h.yaw / two) * two;
      h.yaw += (goal - h.yaw) * k;
      h.velocity = 0;
    }

    if (turn.current) {
      turn.current.rotation.y = h.yaw;
    }

    const wantDark = look.glow && built.flames.length > 0 ? 1 : 0;
    dim.current += (wantDark - dim.current) * (1 - Math.exp(-dt * 5));

    if (keyLight.current) {
      keyLight.current.intensity = 2.1 * (1 - 0.94 * dim.current);
    }

    if (skyLight.current) {
      skyLight.current.intensity = 0.55 * (1 - 0.9 * dim.current);
    }

    scene.environmentIntensity = 0.75 * (1 - 0.92 * dim.current);

    if (floor.current) {
      floor.current.color.copy(floorColour.day).lerp(floorColour.night, dim.current);
    }

    const showSlice = look.view === "inside";
    sliceScale.current += ((showSlice ? 1 : 0.001) - sliceScale.current) * (1 - Math.exp(-dt * 7));

    if (sliceRef.current) {
      sliceRef.current.scale.setScalar(sliceScale.current);
      sliceRef.current.visible = sliceScale.current > 0.01;
    }

    if (built.flames.length > 0) {
      const flicker = 0.85 + 0.15 * Math.sin(now * 0.021) + 0.08 * Math.sin(now * 0.047);
      built.flames.forEach((flame, i) => {
        const wave = 1 + 0.12 * Math.sin(now * 0.03 + i * 1.7);
        flame.scale.set(0.75, 1.6 * wave, 0.75);
      });

      if (flameLight.current) {
        flameLight.current.intensity = flicker * (1 + 2.5 * dim.current);
        flameLight.current.position.set(0, built.bodyTop + 0.55, 0);
      }
    } else if (flameLight.current) {
      flameLight.current.intensity = 0;
    }

    state.invalidate();
  });

  return (
    <>
      <directionalLight
        ref={keyLight}
        position={[2.6, 6.5, 3.6]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={5}
      />
      <hemisphereLight ref={skyLight} args={["#FFFFFF", "#F3DFB8", 0.55]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.3, 72]} />
        <meshStandardMaterial ref={floor} color="#FFF7E0" roughness={1} />
      </mesh>
      <group ref={turn}>
        <primitive object={built.group} onClick={partClicked} />
        <pointLight ref={flameLight} color="#FFA64D" intensity={0} distance={3.2} decay={2} />
      </group>
      <group ref={sliceRef} scale={0.001} visible={false}>
        <primitive object={slice} onClick={partClicked} />
      </group>
    </>
  );
}

/**
 * The live 3D cake for Cake Studio, built the way the design draws it: a stand, extruded tiers,
 * the finish and toppings as real pieces, the message written on top, a slice for the Inside
 * step and a camera that follows the step. Drag to turn, scroll or pinch to zoom, arrow keys too.
 * Loaded only in the browser: three.js does not run in server rendering.
 */
export default function CakeScene({
  look,
  onPart,
  onGrab,
}: {
  look: CakeLook;
  /** Called with the step a clicked part belongs to. */
  onPart?: (step: number) => void;
  /** Receives a function that gives a PNG of the cake. */
  onGrab?: (grab: CakeGrab) => void;
}) {
  const hand = useRef<Hand>({
    yaw: 0.5,
    velocity: 0,
    tilt: 0,
    zoom: 1,
    idleAt: 0,
    dragging: false,
    pointers: new Map(),
    last: { x: 0, y: 0 },
    pinch: 0,
  });
  const photo = useLoadedImage(look.photo);

  const spread = () => {
    const points = [...hand.current.pointers.values()];

    return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const h = hand.current;
    h.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    h.idleAt = performance.now();

    if (h.pointers.size === 2) {
      h.pinch = spread();
      h.dragging = false;

      return;
    }

    h.dragging = true;
    h.velocity = 0;
    h.last = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const h = hand.current;

    if (!h.pointers.has(event.pointerId)) {
      return;
    }

    h.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    h.idleAt = performance.now();

    if (h.pointers.size === 2) {
      const distance = spread();

      if (h.pinch > 0 && distance > 0) {
        h.zoom = Math.max(0.6, Math.min(1.4, h.zoom * (h.pinch / distance)));
      }

      h.pinch = distance;

      return;
    }

    if (!h.dragging) {
      return;
    }

    const dx = event.clientX - h.last.x;
    const dy = event.clientY - h.last.y;
    h.last = { x: event.clientX, y: event.clientY };
    h.yaw += dx * 0.011;
    h.velocity = dx * 0.011 * 60;
    h.tilt = Math.max(-0.14, Math.min(0.5, h.tilt + dy * 0.005));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const h = hand.current;
    h.pointers.delete(event.pointerId);

    if (h.pointers.size === 0) {
      h.dragging = false;
    }

    h.idleAt = performance.now();
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const h = hand.current;
    h.zoom = Math.max(0.6, Math.min(1.4, h.zoom * (event.deltaY > 0 ? 1.06 : 0.94)));
    h.idleAt = performance.now();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const h = hand.current;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => (h.yaw -= 0.25),
      ArrowRight: () => (h.yaw += 0.25),
      ArrowUp: () => (h.tilt = Math.min(0.5, h.tilt + 0.08)),
      ArrowDown: () => (h.tilt = Math.max(-0.14, h.tilt - 0.08)),
      "+": () => (h.zoom = Math.max(0.6, h.zoom * 0.92)),
      "=": () => (h.zoom = Math.max(0.6, h.zoom * 0.92)),
      "-": () => (h.zoom = Math.min(1.4, h.zoom * 1.08)),
    };

    if (keys[event.key]) {
      keys[event.key]();
      h.idleAt = performance.now();
      event.preventDefault();
    }
  };

  return (
    <div
      className="size-full cursor-grab touch-none outline-none active:cursor-grabbing"
      tabIndex={0}
      aria-label="Your cake. Drag to turn it, scroll to zoom, click a part to edit it."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, 2]}
        camera={{ fov: 30, near: 0.1, far: 60, position: [0, 2.8, 9] }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <Scene look={look} photo={photo} hand={hand} onPart={onPart} onGrab={onGrab} />
      </Canvas>
    </div>
  );
}

/** Loads the photo once so the texture can draw it; null until it is ready. */
function useLoadedImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);

      return;
    }

    const loaded = new Image();
    let active = true;
    loaded.onload = () => {
      if (active) {
        setImage(loaded);
      }
    };
    loaded.src = url;

    return () => {
      active = false;
    };
  }, [url]);

  return image;
}
