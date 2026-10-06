// Real Razorpay (India, Route on_hold transfers) and Stripe Connect (US,
// separate charges & transfers) escrow calls. No mocks: missing keys throw.

export const COMMISSION_RATE = 0.2;

export function split(amount: number) {
  const commission = Math.round(amount * COMMISSION_RATE);
  return { commission, payout: amount - commission };
}

function rzpAuth() {
  const id = process.env["RAZORPAY_KEY_ID"], secret = process.env["RAZORPAY_KEY_SECRET"];
  if (!id || !secret) throw new Error("Razorpay is not configured yet. Ask the admin to add Razorpay keys.");
  return { id, secret, header: "Basic " + btoa(`${id}:${secret}`) };
}

async function rzp(path: string, method: string, body?: unknown) {
  const { header } = rzpAuth();
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: header, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`Razorpay: ${json?.error?.description ?? res.status}`);
  return json;
}

export async function razorpayCreateOrder(opts: { amountInr: number; receipt: string; expertAccount: string | null }) {
  const { payout } = split(opts.amountInr);
  const order = await rzp("/orders", "POST", {
    amount: opts.amountInr * 100,
    currency: "INR",
    receipt: opts.receipt.slice(0, 40),
    payment_capture: 1,
    ...(opts.expertAccount
      ? { transfers: [{ account: opts.expertAccount, amount: payout * 100, currency: "INR", on_hold: 1 }] }
      : {}),
  });
  return { orderId: order.id as string, keyId: rzpAuth().id };
}

export async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function razorpayVerifyCheckout(orderId: string, paymentId: string, signature: string) {
  const { secret } = rzpAuth();
  return safeEqual(await hmacHex(secret, `${orderId}|${paymentId}`), signature);
}

export async function razorpayRelease(opts: { paymentId: string; transferId: string | null; expertAccount: string | null; payoutInr: number }) {
  if (opts.transferId) {
    await rzp(`/transfers/${opts.transferId}`, "PATCH", { on_hold: 0 });
    return opts.transferId;
  }
  if (!opts.expertAccount) throw new Error("Expert has no Razorpay linked account for payouts");
  const t = await rzp(`/payments/${opts.paymentId}/transfers`, "POST", {
    transfers: [{ account: opts.expertAccount, amount: opts.payoutInr * 100, currency: "INR", on_hold: 0 }],
  });
  return (t.items?.[0]?.id as string) ?? null;
}

export async function razorpayFindTransfer(paymentId: string) {
  const t = await rzp(`/payments/${paymentId}/transfers`, "GET");
  return (t.items?.[0]?.id as string) ?? null;
}

export async function razorpayRefund(paymentId: string, transferId: string | null) {
  if (transferId) await rzp(`/transfers/${transferId}/reversals`, "POST", {}).catch(() => null);
  await rzp(`/payments/${paymentId}/refund`, "POST", {});
}

// ---------- Stripe ----------
function stripeKey() {
  const k = process.env["STRIPE_SECRET_KEY"];
  if (!k) throw new Error("Stripe is not configured yet. Ask the admin to add Stripe keys.");
  return k;
}
async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`Stripe: ${json?.error?.message ?? res.status}`);
  return json;
}

export async function stripeCreateCheckout(opts: { amountUsd: number; paymentRowId: string; title: string; origin: string; problemId: string }) {
  const s = await stripe("/checkout/sessions", {
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(opts.amountUsd * 100),
    "line_items[0][price_data][product_data][name]": `FixBridge job: ${opts.title}`.slice(0, 120),
    "line_items[0][quantity]": "1",
    "payment_intent_data[transfer_group]": opts.paymentRowId,
    "metadata[payment_row_id]": opts.paymentRowId,
    client_reference_id: opts.paymentRowId,
    success_url: `${opts.origin}/c/problem/${opts.problemId}?paid=1`,
    cancel_url: `${opts.origin}/c/problem/${opts.problemId}`,
  });
  return { url: s.url as string, sessionId: s.id as string };
}

export async function stripeRelease(opts: { chargeId: string; account: string | null; payoutUsd: number; group: string }) {
  if (!opts.account) throw new Error("Expert has no Stripe Connect account for payouts");
  const t = await stripe("/transfers", {
    amount: String(opts.payoutUsd * 100),
    currency: "usd",
    destination: opts.account,
    source_transaction: opts.chargeId,
    transfer_group: opts.group,
  });
  return t.id as string;
}

export async function stripeRefund(paymentIntent: string) {
  await stripe("/refunds", { payment_intent: paymentIntent });
}

export async function stripeVerifyWebhook(rawBody: string, header: string | null) {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  return safeEqual(await hmacHex(secret, `${t}.${rawBody}`), v1);
}

export async function stripeLatestCharge(paymentIntent: string) {
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntent}`, {
    headers: { Authorization: `Bearer ${stripeKey()}` },
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`Stripe: ${json?.error?.message ?? res.status}`);
  return json.latest_charge as string;
}
