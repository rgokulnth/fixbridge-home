import { createFileRoute } from "@tanstack/react-router";
import { hmacHex, safeEqual } from "@/lib/payments.server";

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        const sig = request.headers.get("x-razorpay-signature") ?? "";
        const body = await request.text();
        if (!secret || !safeEqual(await hmacHex(secret, body), sig)) return new Response("Invalid signature", { status: 401 });

        const evt = JSON.parse(body) as { event: string; payload: any };
        const eventId = request.headers.get("x-razorpay-event-id") ?? `${evt.event}:${evt.payload?.payment?.entity?.id ?? ""}`;
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { error: dup } = await db.from("payment_events").insert({ provider: "razorpay", event_id: eventId, event_type: evt.event, payload: evt });
        if (dup) return new Response("ok"); // already processed

        if (evt.event === "payment.captured" || evt.event === "order.paid") {
          const p = evt.payload?.payment?.entity;
          const orderId = p?.order_id ?? evt.payload?.order?.entity?.id;
          if (orderId && p?.id) {
            const { data: row } = await db.from("payments").select("id").eq("provider_order_id", orderId).maybeSingle();
            if (row) {
              const { markHeld } = await import("@/lib/escrow.server");
              const { razorpayFindTransfer } = await import("@/lib/payments.server");
              const transfer = await razorpayFindTransfer(p.id).catch(() => null);
              await markHeld(db, row.id, p.id, transfer);
            }
          }
        } else if (evt.event === "refund.processed") {
          const pid = evt.payload?.refund?.entity?.payment_id;
          if (pid) await db.from("payments").update({ status: "Refunded" }).eq("provider_payment_id", pid);
        }
        return new Response("ok");
      },
    },
  },
});
