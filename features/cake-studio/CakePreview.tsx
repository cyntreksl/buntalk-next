import type { CakeDesign } from "@/lib/erp";
import type { Menu } from "@/lib/cake-studio/design";

/** Sprinkle and topping dots, from the brand palette (styles/tokens.css). */
const SPRINKLES = [
  "var(--color-red-300)",
  "var(--color-orange-300)",
  "var(--color-brown-300)",
  "var(--color-orange-500)",
  "var(--color-red-500)",
];

const W = 320;
const H = 300;

/**
 * A simple drawn preview of the design (BUN-181): the decks stacked, in the
 * frosting colour, with a slice of the sponge colours, the drip, toppings,
 * candles and the message. Every option change redraws it. Since BUN-182 it
 * shows while the 3D preview loads, and instead of it without WebGL.
 */
export function CakePreview({ menu, design }: { menu: Menu; design: CakeDesign }) {
  const size = menu.sizes.find((s) => s.id === design.size_id);
  const shape = menu.shapes.find((s) => s.id === design.shape_id);
  const find = (kind: keyof Menu["options"], id?: number | null) =>
    id == null ? undefined : menu.options[kind].find((o) => o.id === id);
  const frosting = find("frosting", design.frosting_id)?.colour ?? "var(--color-white)";
  const sponge = find("sponge", design.sponge_id)?.layerColours ?? ["var(--color-orange-200)"];
  const filling = find("filling", design.filling_id)?.colour;
  const drip = find("drip", design.drip_id)?.colour;
  const finish = find("finish", design.finish_id);
  const toppings = (design.topping_ids ?? [])
    .map((id) => find("topping", id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const writing =
    find("writing_colour", design.writing_colour_id)?.colour ?? "var(--color-brown-800)";

  const decks = Math.max(1, design.tier_count ?? size?.tiers.length ?? 1);
  const own = size?.tiers ?? [{ width: 2, height: 0.8 }];
  // Each deck's width and height: the size's own tiers, then narrower ones on top.
  const tiers = Array.from({ length: decks }, (_, i) => {
    const t = own[i] ?? {
      width: (own.at(-1)?.width ?? 2) * Math.pow(0.75, i - own.length + 1),
      height: own.at(-1)?.height ?? 0.8,
    };
    return t;
  });
  const maxWidth = Math.max(...tiers.map((t) => t.width));
  const scale = Math.min(240 / maxWidth, 170 / tiers.reduce((sum, t) => sum + t.height, 0));
  const rounded = shape?.model === "round" ? 18 : shape?.model === "heart" ? 28 : 4;

  let y = H - 30;
  const drawn = tiers.map((t, i) => {
    const w = t.width * scale;
    const h = t.height * scale;
    y -= h;
    return { x: (W - w) / 2, y, w, h, i };
  });
  const top = drawn.at(-1)!;
  const candles = toppings.find((t) => t.maxCount) ? Math.min(design.candle_count ?? 1, 12) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Preview: ${size?.name ?? ""} ${shape?.name.toLowerCase() ?? ""} cake, ${decks} deck${decks === 1 ? "" : "s"}`}
      className="h-auto w-full"
    >
      {/* Cake board */}
      <ellipse cx={W / 2} cy={H - 26} rx={150} ry={12} fill="var(--color-sand-200)" />
      {drawn.map((d) => (
        <g key={d.i}>
          <rect
            x={d.x}
            y={d.y}
            width={d.w}
            height={d.h}
            rx={rounded}
            fill={frosting}
            stroke="var(--color-black)"
            strokeOpacity={0.08}
          />
          {/* A slice showing the sponge (and filling) colours */}
          {sponge.map((c, j) => (
            <rect
              key={j}
              x={d.x + d.w - 26}
              y={d.y + 6 + (j * (d.h - 12)) / sponge.length}
              width={18}
              height={(d.h - 12) / sponge.length - (filling ? 2 : 0)}
              fill={c}
            />
          ))}
          {drip && (
            <path
              d={`M${d.x} ${d.y + 6} h${d.w} v8 ${Array.from({ length: 6 }, (_, k) => `q-${d.w / 12} ${k % 2 ? 14 : 22} -${d.w / 6} 0`).join(" ")} z`}
              fill={drip}
            />
          )}
          {finish?.style === "piped" && (
            <line
              x1={d.x + 4}
              x2={d.x + d.w - 4}
              y1={d.y + d.h - 3}
              y2={d.y + d.h - 3}
              stroke="var(--color-white)"
              strokeOpacity={0.8}
              strokeWidth={5}
              strokeDasharray="2 6"
              strokeLinecap="round"
            />
          )}
        </g>
      ))}
      {/* Toppings on the top deck */}
      {toppings
        .filter((t) => !t.maxCount)
        .map((t, k) =>
          Array.from({ length: 7 }, (_, n) => (
            <circle
              key={`${t.id}-${n}`}
              cx={top.x + 14 + ((n * 37 + k * 11) % Math.max(20, top.w - 28))}
              cy={top.y - 4 - (k % 2) * 4}
              r={t.style === "sprinkles" ? 2.5 : 5}
              fill={SPRINKLES[(n + k) % 5]}
            />
          )),
        )}
      {Array.from({ length: candles }, (_, n) => {
        const cx = top.x + 12 + ((top.w - 24) * (n + 0.5)) / candles;
        return (
          <g key={n}>
            <rect x={cx - 2} y={top.y - 24} width={4} height={22} fill="var(--color-red-200)" />
            <ellipse cx={cx} cy={top.y - 28} rx={3} ry={5} fill="var(--color-orange-400)" />
          </g>
        );
      })}
      {design.message && (
        <text
          x={W / 2}
          y={drawn[0].y + drawn[0].h / 2 + 5}
          textAnchor="middle"
          fontSize={14}
          fontStyle={
            find("lettering", design.lettering_id)?.style === "script" ? "italic" : "normal"
          }
          fontWeight={700}
          fill={writing}
        >
          {design.message}
        </text>
      )}
    </svg>
  );
}
