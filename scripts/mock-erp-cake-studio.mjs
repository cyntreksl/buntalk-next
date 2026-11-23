/**
 * Mock ERP Cake Studio (BUN-179, contract ticket BUN-260). Mirrors the ERP's
 * sample menu (AddCakeStudioSampleMenu) and the rules of its pricing
 * (PriceCakeDesign), design check (NormaliseCakeDesign) and summary
 * (DescribeCakeDesign), so the storefront can be built and tested without the
 * real ERP endpoints.
 *
 *   GET  …/cake-studio/menu
 *   POST …/cake-studio/quote          { design }
 *   POST …/cake-studio/designs        { design }   → 201 { id, … }
 *   GET  …/cake-studio/designs/{id}               (priced again now)
 *   POST /__mock/cake-studio          { options: [{ id, price }], sizes: [{ id, price }] }
 */
import { randomUUID } from "node:crypto";

const DAY = 24 * 60 * 60 * 1000;

export function seedCakeStudio() {
  let next = 1;
  const nid = () => next++;
  const shapes = [
    { id: nid(), name: "Round", model: "round", price: 0 },
    { id: nid(), name: "Square", model: "square", price: 0 },
    { id: nid(), name: "Heart", model: "heart", price: 250 },
  ];
  const sizes = [
    ["1 kg", 1, [[1.8, 0.8]], 8, 10, 3900],
    ["2 kg", 2, [[2.3, 0.9]], 16, 20, 7200],
    [
      "3 kg",
      3,
      [
        [2.4, 0.78],
        [1.6, 0.72],
      ],
      25,
      30,
      11500,
    ],
  ].map(([name, weight, tiers, min, max, price]) => ({
    id: nid(),
    name,
    weight_kg: String(weight),
    tiers: tiers.map(([width, height]) => ({ width, height })),
    serves_min: min,
    serves_max: max,
    price,
    // Heart isn't made in 3 kg.
    shape_ids: name === "3 kg" ? [shapes[0].id, shapes[1].id] : shapes.map((s) => s.id),
    // BUN-180: the "Design your own cake" product size this cake size is sold as.
    sku_link_id: `sku-studio-${name.replace(" ", "").toLowerCase()}`,
  }));
  const option = (kind, o) => ({
    id: nid(),
    kind,
    code: null,
    price: 0,
    colour: null,
    layer_colours: null,
    max_count: null,
    needs_drip: false,
    style: null,
    ...o,
  });
  const options = [
    option("sponge", { name: "Butter", layer_colours: ["#F2D488", "#F2D488", "#F2D488"] }),
    option("sponge", {
      name: "Chocolate",
      price: 300,
      layer_colours: ["#5A3420", "#5A3420", "#5A3420"],
    }),
    option("sponge", {
      name: "Red velvet",
      price: 400,
      layer_colours: ["#9B1B30", "#9B1B30", "#9B1B30"],
    }),
    option("filling", { name: "Vanilla cream", colour: "#FFF8EC" }),
    option("filling", { name: "Chocolate ganache", price: 250, colour: "#3B2216" }),
    option("filling", { name: "Strawberry jam", price: 150, colour: "#C2334D" }),
    option("frosting", { name: "White", colour: "#FFFAF0" }),
    option("frosting", { name: "Pink", colour: "#F7B6C8" }),
    option("frosting", { name: "Cocoa", colour: "#6B3F26" }),
    option("finish", { name: "Smooth", style: "smooth" }),
    option("finish", { name: "Piped border", price: 300, style: "piped" }),
    option("finish", { name: "Drip", price: 350, needs_drip: true, style: "drip" }),
    option("drip", { name: "Chocolate", colour: "#4A2A1A" }),
    option("drip", { name: "Caramel", colour: "#C8843A" }),
    option("topping", { name: "Fresh fruit", price: 450, style: "fruit" }),
    option("topping", { name: "Sprinkles", price: 150, style: "sprinkles" }),
    option("topping", { name: "Candles", price: 100, max_count: 12, style: "candles" }),
    option("writing_colour", { name: "Chocolate", colour: "#4A2A1A" }),
    option("writing_colour", { name: "Gold", colour: "#B98A1E" }),
    option("lettering", { name: "Script", style: "script" }),
    option("lettering", { name: "Bold", style: "bold" }),
    option("extra", { code: "eggless", name: "Eggless recipe", price: 300 }),
    option("extra", { code: "less_sugar", name: "Less sugar" }),
    option("extra", { code: "number_topper", name: "Gold number topper", price: 350 }),
    option("extra", { code: "photo_print", name: "Edible photo print", price: 500 }),
  ];
  const occasions = [
    { id: nid(), name: "Birthday", messages: ["Happy Birthday", "සුබ උපන්දිනයක්", "Best wishes"] },
    { id: nid(), name: "Wedding", messages: ["Congratulations", "Just married", "Mr and Mrs"] },
  ];
  const byName = (kind, name) => options.find((o) => o.kind === kind && o.name === name).id;
  const favourites = [
    {
      id: nid(),
      name: "Classic chocolate birthday",
      occasion_ids: [occasions[0].id],
      config: {
        size_id: sizes[0].id,
        shape_id: shapes[0].id,
        sponge_id: byName("sponge", "Chocolate"),
        filling_id: byName("filling", "Chocolate ganache"),
        frosting_id: byName("frosting", "Cocoa"),
        finish_id: byName("finish", "Drip"),
        drip_id: byName("drip", "Caramel"),
        topping_ids: [byName("topping", "Candles")],
        candle_count: 5,
        message: "Happy Birthday",
      },
    },
  ];
  return {
    shapes,
    sizes,
    options,
    occasions,
    favourites,
    rules: {
      is_open: true,
      notice_hours: 48,
      message_max: 24,
      photo_max_kb: 4096,
      deck_prices: { 2: 2500, 3: 3500 },
      deck_height_min_cm: 6,
      deck_height_max_cm: 20,
      height_cm_price: 150,
      welcome: "Design your cake: pick a size, flavours and decorations, and we'll bake it fresh.",
    },
    designs: [],
  };
}

const money = (n) => Number(n).toFixed(2);
const earliest = (studio) =>
  new Date(Date.now() + studio.rules.notice_hours * 60 * 60 * 1000 + DAY - 1)
    .toISOString()
    .slice(0, 10);

export function cakeMenu(studio) {
  const shapeById = new Map(studio.shapes.map((s) => [s.id, s]));
  const kinds = [
    "sponge",
    "filling",
    "frosting",
    "finish",
    "drip",
    "topping",
    "writing_colour",
    "lettering",
    "extra",
  ];
  return {
    sizes: studio.sizes.map((s) => ({
      id: s.id,
      name: s.name,
      weight_kg: s.weight_kg,
      tiers: s.tiers,
      serves_min: s.serves_min,
      serves_max: s.serves_max,
      shape_prices: Object.fromEntries(
        s.shape_ids.map((id) => [String(id), money(s.price + shapeById.get(id).price)]),
      ),
      earliest: earliest(studio),
      sku_link_id: s.sku_link_id ?? null,
    })),
    shapes: studio.shapes.map(({ id, name, model }) => ({ id, name, model })),
    options: Object.fromEntries(
      kinds.map((k) => [
        k,
        studio.options
          .filter((o) => o.kind === k)
          .map((o) => ({ ...o, kind: undefined, price: money(o.price) })),
      ]),
    ),
    occasions: studio.occasions,
    favourites: studio.favourites,
    rules: {
      is_open: studio.rules.is_open,
      message_max: studio.rules.message_max,
      photo_max_kb: studio.rules.photo_max_kb,
      deck_prices: Object.fromEntries(
        Object.entries(studio.rules.deck_prices).map(([k, v]) => [k, money(v)]),
      ),
      deck_height_min_cm: studio.rules.deck_height_min_cm,
      deck_height_max_cm: studio.rules.deck_height_max_cm,
      height_cm_price: money(studio.rules.height_cm_price),
      welcome: studio.rules.welcome,
    },
  };
}

/** NormaliseCakeDesign + PriceCakeDesign + DescribeCakeDesign, simplified. */
export function cakeQuote(studio, picks) {
  const errors = {};
  const pick = (kind, id) =>
    studio.options.find((o) => o.kind === kind && o.id === Number(id)) ?? null;
  const size = studio.sizes.find((s) => s.id === Number(picks?.size_id));
  const shape = studio.shapes.find((s) => s.id === Number(picks?.shape_id));
  const sponge = pick("sponge", picks?.sponge_id);
  const filling = pick("filling", picks?.filling_id);
  const frosting = pick("frosting", picks?.frosting_id);
  const finish = pick("finish", picks?.finish_id);
  const drip = finish?.needs_drip ? pick("drip", picks?.drip_id) : null;
  if (!size) errors.size_id = ["Choose a size."];
  if (!shape) errors.shape_id = ["Choose a shape."];
  else if (size && !size.shape_ids.includes(shape.id))
    errors.shape_id = [
      `A ${size.name} cake is not made ${shape.name.toLowerCase()}. Choose another shape.`,
    ];
  if (!sponge) errors.sponge_id = ["Choose a sponge."];
  if (!frosting) errors.frosting_id = ["Choose a frosting colour."];
  if (!finish) errors.finish_id = ["Choose a finish."];
  else if (finish.needs_drip && !drip) errors.drip_id = ["Choose a drip flavour."];
  const toppings = studio.options.filter(
    (o) => o.kind === "topping" && (picks?.topping_ids ?? []).map(Number).includes(o.id),
  );
  const counted = toppings.find((t) => t.max_count);
  const candleCount = counted ? Math.max(1, Number(picks?.candle_count ?? 1)) : null;
  if (counted && candleCount > counted.max_count)
    errors.candle_count = [`No more than ${counted.max_count} ${counted.name.toLowerCase()}.`];
  const extras = studio.options.filter(
    (o) => o.kind === "extra" && (picks?.extras ?? []).includes(o.code),
  );
  const hasTopper = extras.some((e) => e.code === "number_topper");
  const topperNumber = hasTopper ? String(picks?.topper_number ?? "").trim() : null;
  if (hasTopper && !/^\d{1,3}$/.test(topperNumber))
    errors.topper_number = ["Give the number for the topper, up to 3 digits."];
  const message = String(picks?.message ?? "").trim();
  if (message.length > studio.rules.message_max)
    errors.message = [`Keep the message to ${studio.rules.message_max} letters.`];
  if (Object.keys(errors).length > 0) {
    return { error: 422, body: { message: Object.values(errors)[0][0], errors } };
  }
  const lettering = message
    ? (pick("lettering", picks?.lettering_id) ?? studio.options.find((o) => o.kind === "lettering"))
    : null;
  const writing = message
    ? (pick("writing_colour", picks?.writing_colour_id) ??
      studio.options.find((o) => o.kind === "writing_colour"))
    : null;
  const occasion = studio.occasions.find((o) => o.id === Number(picks?.occasion_id)) ?? null;
  const tierCount = Number(picks?.tier_count ?? size.tiers.length) || size.tiers.length;

  const lines = [
    {
      label: `${size.name} ${shape.name.toLowerCase()} cake`,
      cents: Math.round((size.price + shape.price) * 100),
    },
  ];
  for (let deck = size.tiers.length + 1; deck <= tierCount; deck++) {
    lines.push({
      label: `Deck ${deck}`,
      cents: Math.round((studio.rules.deck_prices[deck] ?? 0) * 100),
    });
  }
  const optionLine = (o, label = o.name) => lines.push({ label, cents: Math.round(o.price * 100) });
  optionLine(sponge, `${sponge.name} sponge`);
  if (filling) optionLine(filling, `${filling.name} filling`);
  optionLine(finish, `${finish.name} finish`);
  for (const t of toppings) optionLine(t, t.max_count ? `${t.name}, ${candleCount}` : t.name);
  for (const e of extras)
    optionLine(e, e.code === "number_topper" ? `${e.name} ${topperNumber}` : e.name);
  const kept = lines.filter((l, i) => i === 0 || l.cents > 0);
  const total = kept.reduce((sum, l) => sum + l.cents, 0);

  const join = (parts) => parts.filter(Boolean).join(", ");
  const summary = [
    {
      label: "Size and shape",
      value: join([
        size.name,
        shape.name,
        tierCount === 1 ? "one deck" : `${tierCount} decks`,
        `serves ${size.serves_min} to ${size.serves_max}`,
      ]),
    },
    {
      label: "Inside",
      value: join([
        `${sponge.name} sponge`,
        filling && `${filling.name} filling`,
        ...extras.filter((e) => ["eggless", "less_sugar"].includes(e.code)).map((e) => e.name),
      ]),
    },
    { label: "Frosting", value: join([frosting.name, finish.name, drip && `${drip.name} drip`]) },
    {
      label: "Toppings",
      value:
        join([
          ...toppings.map((t) => (t.max_count ? `${t.name} (${candleCount})` : t.name)),
          hasTopper && `Number topper ${topperNumber}`,
        ]) || "None",
    },
    {
      label: "Message",
      value: message
        ? join([`"${message}"`, lettering?.name, writing && `${writing.name} writing`])
        : "No message",
    },
    ...(occasion ? [{ label: "Occasion", value: occasion.name }] : []),
  ];
  return {
    data: {
      design: {
        size_id: size.id,
        tier_count: tierCount,
        deck_heights: null,
        shape_id: shape.id,
        sponge_id: sponge.id,
        filling_id: filling?.id ?? null,
        frosting_id: frosting.id,
        finish_id: finish.id,
        drip_id: drip?.id ?? null,
        topping_ids: toppings.map((t) => t.id),
        candle_count: candleCount,
        extras: extras.map((e) => e.code),
        topper_number: topperNumber,
        message,
        lettering_id: lettering?.id ?? null,
        writing_colour_id: writing?.id ?? null,
        occasion_id: occasion?.id ?? null,
      },
      lines: kept.map((l) => ({ label: l.label, price: money(l.cents / 100) })),
      total: money(total / 100),
      summary,
      earliest_date: earliest(studio),
    },
  };
}

const ORIGIN = `http://127.0.0.1:${process.env.MOCK_ERP_PORT ?? 4010}`;
const savedExtras = (saved) => ({
  id: saved.id,
  created_at: saved.created_at,
  preview_url: saved.preview ? `${ORIGIN}/images/cake-designs/${saved.id}.png` : null,
});

/** The stored preview picture of a saved design, or null (GET /images/cake-designs/{id}.png). */
export function cakeDesignPreview(studio, path) {
  const m = path.match(/^\/images\/cake-designs\/([A-Za-z0-9-]+)\.png$/);
  return m ? (studio.designs.find((d) => d.id === m[1])?.preview ?? null) : null;
}

/**
 * Handles …/cake-studio/* routes. Returns [status, body] or null when the
 * route isn't a Cake Studio one.
 */
export function handleCakeStudio(studio, route, method, body) {
  if (route === "/cake-studio/menu" && method === "GET") return [200, { data: cakeMenu(studio) }];
  if (route === "/cake-studio/quote" && method === "POST") {
    const q = cakeQuote(studio, body?.design);
    return q.error ? [q.error, q.body] : [200, q];
  }
  if (route === "/cake-studio/designs" && method === "POST") {
    const q = cakeQuote(studio, body?.design);
    if (q.error) return [q.error, q.body];
    const saved = { id: randomUUID(), config: q.data.design, created_at: new Date().toISOString() };
    // BUN-182: the picture of the 3D preview, served at /images/cake-designs/{id}.png.
    if (typeof body?.preview_png === "string" && body.preview_png.length > 0) {
      saved.preview = Buffer.from(body.preview_png, "base64");
    }
    studio.designs.push(saved);
    return [201, { data: { ...q.data, ...savedExtras(saved) } }];
  }
  const m = route.match(/^\/cake-studio\/designs\/([A-Za-z0-9-]+)$/);
  if (m && method === "GET") {
    const saved = studio.designs.find((d) => d.id === m[1]);
    if (!saved) return [404, { message: "Not Found" }];
    // Priced again with today's menu and prices.
    const q = cakeQuote(studio, saved.config);
    if (q.error) return [q.error, q.body];
    return [200, { data: { ...q.data, ...savedExtras(saved) } }];
  }
  return null;
}

/** POST /__mock/cake-studio: change option or size prices (and rules), like staff would. */
export function patchCakeStudio(studio, body) {
  for (const o of body?.options ?? []) {
    const found = studio.options.find((x) => x.id === o.id);
    if (found) Object.assign(found, o);
  }
  for (const s of body?.sizes ?? []) {
    const found = studio.sizes.find((x) => x.id === s.id);
    if (found) Object.assign(found, s);
  }
  if (body?.rules) Object.assign(studio.rules, body.rules);
  return cakeMenu(studio);
}
