import type { CakeOptionKind, CakeStudioMenu } from "@/lib/erp";
import { cx, formatPrice } from "@/lib/utils";

const CURRENCY = "LKR";
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const readyDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d);
};

/** "+ LKR 300", or nothing when it's included in the price. */
const extraPrice = (price: number) =>
  price > 0 ? (
    <span className="text-muted-foreground">+ {formatPrice(price, CURRENCY)}</span>
  ) : null;

function Swatch({ colours, label }: { colours: string[]; label: string }) {
  return (
    <span
      aria-hidden="true"
      title={label}
      className="border-border inline-flex size-6 shrink-0 overflow-hidden rounded-full border"
    >
      {colours.map((c, i) => (
        <span key={`${c}-${i}`} className="h-full flex-1" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

const sections: { kind: CakeOptionKind; title: string; hint?: string }[] = [
  { kind: "sponge", title: "Sponge" },
  { kind: "filling", title: "Filling" },
  { kind: "frosting", title: "Frosting colour" },
  { kind: "finish", title: "Finish" },
  { kind: "drip", title: "Drip flavour", hint: "With the drip finish" },
  { kind: "topping", title: "Toppings" },
  { kind: "extra", title: "Extras" },
  { kind: "writing_colour", title: "Writing colour" },
  { kind: "lettering", title: "Lettering" },
];

/**
 * The Cake Studio menu exactly as the ERP has it (BUN-179): sizes with their
 * starting price, serving sizes and earliest ready date, shapes, every option
 * with its price and colour, occasions and favourites. Nothing here is set in
 * the storefront: change it in the ERP and the page follows.
 */
export function CakeStudioMenuView({
  menu,
  highlightSizeId,
}: {
  menu: CakeStudioMenu;
  /** The size of the cake the customer came from (BUN-180). */
  highlightSizeId?: number;
}) {
  const shapeName = new Map(menu.shapes.map((s) => [String(s.id), s.name]));
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="cake-sizes" className="flex flex-col gap-4">
        <h2 id="cake-sizes" className="text-h3">
          Sizes
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {menu.sizes.map((size) => (
            <li
              key={size.id}
              aria-current={size.id === highlightSizeId ? "true" : undefined}
              className={cx(
                "bg-surface flex flex-col gap-2 rounded-xl border p-4",
                size.id === highlightSizeId
                  ? "border-primary ring-primary ring-2"
                  : "border-border",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-h4">{size.name}</span>
                <span className="font-bold">From {formatPrice(size.fromPrice, CURRENCY)}</span>
              </div>
              <p className="text-body-sm text-muted-foreground">
                Serves {size.servesMin} to {size.servesMax} ·{" "}
                {size.tiers.length === 1 ? "one tier" : `${size.tiers.length} tiers`}
              </p>
              <p className="text-body-sm text-muted-foreground">
                Made{" "}
                {Object.keys(size.shapePrices)
                  .map((id) => shapeName.get(id)?.toLowerCase())
                  .filter(Boolean)
                  .join(", ")}{" "}
                · ready from {readyDate(size.earliest)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cake-shapes" className="flex flex-col gap-3">
        <h2 id="cake-shapes" className="text-h3">
          Shapes
        </h2>
        <ul className="flex flex-wrap gap-2">
          {menu.shapes.map((shape) => (
            <li key={shape.id} className="bg-surface-muted rounded-full px-4 py-1.5 font-semibold">
              {shape.name}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        {sections
          .filter((s) => menu.options[s.kind].length > 0)
          .map((section) => (
            <section
              key={section.kind}
              aria-labelledby={`cake-${section.kind}`}
              className="flex flex-col gap-3"
            >
              <h2 id={`cake-${section.kind}`} className="text-h4">
                {section.title}
                {section.hint && (
                  <span className="text-body-sm text-muted-foreground ml-2 font-normal">
                    {section.hint}
                  </span>
                )}
              </h2>
              <ul className="divide-border border-border divide-y border-y">
                {menu.options[section.kind].map((option) => {
                  const colours = option.layerColours ?? (option.colour ? [option.colour] : []);
                  return (
                    <li key={option.id} className="flex items-center gap-3 py-2">
                      {colours.length > 0 && <Swatch colours={colours} label={option.name} />}
                      <span className={cx("flex-1", option.price > 0 && "font-semibold")}>
                        {option.name}
                        {option.maxCount && (
                          <span className="text-body-sm text-muted-foreground">
                            {" "}
                            (up to {option.maxCount})
                          </span>
                        )}
                      </span>
                      {extraPrice(option.price)}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>

      {menu.occasions.length > 0 && (
        <section aria-labelledby="cake-occasions" className="flex flex-col gap-3">
          <h2 id="cake-occasions" className="text-h4">
            Occasions and messages
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {menu.occasions.map((o) => (
              <li key={o.id} className="bg-surface-muted rounded-lg px-4 py-3">
                <span className="font-bold">{o.name}</span>
                <span className="text-body-sm text-muted-foreground block">
                  {o.messages.map((m) => `"${m}"`).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-body-sm text-muted-foreground">
            Your own message can be up to {menu.rules.messageMax} letters.
          </p>
        </section>
      )}

      {menu.favourites.length > 0 && (
        <section aria-labelledby="cake-favourites" className="flex flex-col gap-3">
          <h2 id="cake-favourites" className="text-h4">
            Favourites to start from
          </h2>
          <ul className="flex flex-wrap gap-2">
            {menu.favourites.map((f) => (
              <li
                key={f.id}
                className="border-accent bg-accent-soft text-accent-soft-foreground rounded-full border px-4 py-1.5 font-semibold"
              >
                {f.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
