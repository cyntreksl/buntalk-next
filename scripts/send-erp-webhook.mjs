#!/usr/bin/env node
/**
 * Sends a signed ERP webhook to the storefront, exactly as the ERP must
 * (X-Erp-Signature, HMAC-SHA256; see lib/webhooks/signature.ts). For testing
 * and for refreshing pages by hand.
 *
 *   node scripts/send-erp-webhook.mjs <url> '<json body>'
 *
 *   node scripts/send-erp-webhook.mjs http://localhost:3000/api/revalidate '{"type":"product","slug":"fish-bun"}'
 *   node scripts/send-erp-webhook.mjs https://<site>/api/revalidate '{"type":"all"}'
 *
 * The secret comes from ERP_WEBHOOK_SECRET (environment, .env.local or .env).
 */
import { createHmac } from "node:crypto";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file not present
  }
}

const [url, body] = process.argv.slice(2);
const secret = process.env.ERP_WEBHOOK_SECRET;
if (!url || !body || !secret) {
  console.error(
    "Usage: ERP_WEBHOOK_SECRET=… node scripts/send-erp-webhook.mjs <url> '<json body>'",
  );
  process.exit(1);
}
JSON.parse(body); // fail early on invalid JSON

const t = Math.floor(Date.now() / 1000);
const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Erp-Signature": `t=${t},v1=${v1}` },
  body,
});
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
