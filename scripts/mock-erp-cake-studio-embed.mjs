/**
 * Mock ERP Cake Studio embed page (BUN-180, protocol in ERP ticket BUN-261).
 * Stands in for the ERP's `/cake-studio/embed`: checks the signed session,
 * lets only the session's storefront frame it, and talks to it with the
 * agreed messages (ready, resize, design, saved, error; preselect back).
 * The real ERP shows its 3D designer here; this page uses simple form fields.
 *
 *   GET  /cake-studio/embed?session=…          the page
 *   POST /cake-studio/embed/quote?session=…    { design } → quote
 *   POST /cake-studio/embed/save?session=…     { design } → saved design
 *
 * Needs MOCK_CAKE_STUDIO_SECRET (same as the storefront's CAKE_STUDIO_EMBED_SECRET)
 * and, optionally, MOCK_CAKE_STUDIO_ORIGINS (default http://localhost:3100,http://localhost:3000).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cakeMenu, cakeQuote, handleCakeStudio } from "./mock-erp-cake-studio.mjs";

const allowedOrigins = () =>
  (process.env.MOCK_CAKE_STUDIO_ORIGINS ?? "http://localhost:3100,http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Same check as the ERP: signature, expiry, and an origin on the framing list. */
export function verifySession(token, secret, now = Date.now()) {
  const [payload, signature, ...rest] = String(token ?? "").split(".");
  if (!payload || !signature || rest.length > 0) return { error: "malformed" };
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("base64url"));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { error: "bad signature" };
  }
  let session;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { error: "malformed" };
  }
  if (session?.v !== 1 || typeof session.exp !== "number") return { error: "malformed" };
  if (session.exp * 1000 <= now) return { error: "expired" };
  if (!allowedOrigins().includes(session.origin)) return { error: "origin not allowed" };
  return { session };
}

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** The size to start with: preselect.size_id, else the size linked to preselect.sku_id. */
function preselectedSize(studio, preselect) {
  if (preselect?.size_id && studio.sizes.some((s) => s.id === preselect.size_id)) {
    return preselect.size_id;
  }
  const bySku = studio.sizes.find((s) => s.sku_link_id && s.sku_link_id === preselect?.sku_id);
  return bySku?.id ?? studio.sizes[0].id;
}

const text = (status, body) => ({ status, headers: { "Content-Type": "text/plain" }, body });
const json = (status, data) => ({
  status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

// Runs in the embed page (as a string): talks to the storefront only at ORIGIN.
const PAGE_SCRIPT = `
const Q = location.search;
const post = (m) => parent.postMessage(Object.assign({ source: "buntalk-cake-studio" }, m), ORIGIN);
const form = document.getElementById("f");
const design = () => {
  const d = Object.fromEntries(new FormData(form));
  for (const k of Object.keys(d)) if (k.endsWith("_id")) d[k] = Number(d[k]);
  return d;
};
async function call(path, body) {
  const r = await fetch(path + Q, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return [r.ok, await r.json()];
}
async function price() {
  const [ok, q] = await call("/cake-studio/embed/quote", { design: design() });
  document.getElementById("err").textContent = ok ? "" : q.message;
  if (!ok) return;
  document.getElementById("total").textContent = "LKR " + q.total;
  post({ type: "design", total: q.total, summary: q.summary });
}
form.addEventListener("change", price);
document.getElementById("add").addEventListener("click", async () => {
  const [ok, s] = await call("/cake-studio/embed/save", { design: design() });
  if (ok) post({ type: "saved", design_id: s.id, total: s.total, summary: s.summary });
  else post({ type: "error", message: s.message || "Could not save the design." });
});
window.addEventListener("message", (e) => {
  if (e.origin !== ORIGIN || !e.data || e.data.source !== "buntalk-storefront") return;
  if (e.data.type === "ping") post({ type: "ready" });
  if (e.data.type === "preselect") {
    const r = form.querySelector('input[name="size_id"][value="' + Number(e.data.size_id) + '"]');
    if (r) { r.checked = true; price(); }
  }
});
new ResizeObserver(() =>
  post({ type: "resize", height: Math.max(200, Math.ceil(document.body.getBoundingClientRect().height) + 48) }),
).observe(document.body);
post({ type: "ready" });
price();
// Test hook (mock only): "#autosave" presses "Add to cart", for browser tests that
// can't click inside a cross-origin frame.
window.addEventListener("hashchange", () => {
  if (location.hash === "#autosave") document.getElementById("add").click();
});
`;

function page(studio, session) {
  const menu = cakeMenu(studio);
  const sizeId = preselectedSize(studio, session.preselect);
  const select = (kind, label) =>
    `<label>${label} <select name="${kind}_id">${menu.options[kind]
      .map(
        (o) =>
          `<option value="${o.id}">${escapeHtml(o.name)}${Number(o.price) > 0 ? ` (+${o.price})` : ""}</option>`,
      )
      .join("")}</select></label>`;
  const sizes = menu.sizes
    .map(
      (s) =>
        `<label><input type="radio" name="size_id" value="${s.id}" ${s.id === sizeId ? "checked" : ""}> ${escapeHtml(s.name)}</label>`,
    )
    .join("");
  const shapes = menu.shapes
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cake Studio (mock embed)</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#3b2216;background:#fffaf5}
h2{margin:0 0 4px}fieldset{border:1px solid #e8d8c8;border-radius:12px;padding:12px;margin:0 0 16px}
label{display:block;margin:6px 0}.sizes label{display:inline-flex;gap:6px;margin-right:16px}
select,input[type=text]{padding:6px;border-radius:8px}.total{font-size:20px;font-weight:700;margin:12px 0}
button{background:#d23f14;color:#fff;border:0;border-radius:999px;padding:12px 24px;font-weight:700;cursor:pointer}
.note{font-size:12px;color:#8a6a55}
</style></head><body>
<h2>Cake Studio</h2>
<p class="note">Mock ERP embed (BUN-261 protocol). The real ERP shows its 3D designer here.</p>
<form id="f">
<fieldset class="sizes"><legend>Size</legend>${sizes}</fieldset>
<fieldset><legend>Your cake</legend>
<label>Shape <select name="shape_id">${shapes}</select></label>
${select("sponge", "Sponge")}${select("frosting", "Frosting")}${select("finish", "Finish")}${select("drip", "Drip")}
<label>Message <input type="text" name="message" maxlength="${menu.rules.message_max}" value="Happy Birthday"></label>
</fieldset>
<div class="total" id="total">…</div><p id="err" class="note" role="alert"></p>
<button type="button" id="add">Add to cart</button>
</form>
<script>const ORIGIN = ${JSON.stringify(session.origin)};${PAGE_SCRIPT}</script>
</body></html>`;
}

/**
 * Handles the embed routes (outside the API prefix, like the ERP's web routes).
 * Returns { status, headers, body } or null when the path isn't an embed route.
 */
export async function handleCakeStudioEmbed(studio, path, method, url, readBody) {
  if (!path.startsWith("/cake-studio/embed")) return null;
  const secret = process.env.MOCK_CAKE_STUDIO_SECRET;
  if (!secret) return text(503, "Set MOCK_CAKE_STUDIO_SECRET to use the Cake Studio embed.");
  const checked = verifySession(url.searchParams.get("session"), secret);
  if (checked.error) return text(403, `Cake Studio embed refused: ${checked.error}`);

  if (path === "/cake-studio/embed/quote" && method === "POST") {
    const q = cakeQuote(studio, (await readBody())?.design);
    return q.error ? json(q.error, q.body) : json(200, q.data);
  }
  if (path === "/cake-studio/embed/save" && method === "POST") {
    const [status, body] = handleCakeStudio(
      studio,
      "/cake-studio/designs",
      "POST",
      await readBody(),
    );
    return json(status, body.data ?? body);
  }
  if (path !== "/cake-studio/embed" || method !== "GET") return null;
  return {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Only the storefront in the session may frame it.
      "Content-Security-Policy": `frame-ancestors ${checked.session.origin}`,
    },
    body: page(studio, checked.session),
  };
}
