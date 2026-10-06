import { createFileRoute } from "@tanstack/react-router";
import { stripeVerifyWebhook } from "@/lib/payments.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        if (!(await stripeVerifyWebhook(body, request.headers.get("stripe-signature")))) return new Response("Invalid signature", { status: 401 });
        const evt = JSON.parse(body) as { id: string; type: string; data: { object: any } };
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { error: dup } = await db.from("payment_events").insert({ provider: "stripe", event_id: evt.id, event_type: evt.type, payload: evt });
        if (dup) return new Response("ok");

        if (evt.type === "checkout.session.completed") {
          const s = evt.data.object;
          const rowId = s.metadata?.payment_row_id ?? s.client_reference_id;
          if (rowId && s.payment_status === "paid" && s.payment_intent) {
            const { markHeld } = await import("@/lib/escrow.server");
            await markHeld(db, rowId, s.payment_intent, null);
          }
        } else if (evt.type === "charge.refunded") {
          const pi = evt.data.object.payment_intent;
          if (pi) await db.from("payments").update({ status: "Refunded" }).eq("provider_payment_id", pi);
        }
        return new Response("ok");
      },
    },
  },
});
