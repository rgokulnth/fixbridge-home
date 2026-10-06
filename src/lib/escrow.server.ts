import { enqueue } from "./notify.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Idempotently move a payment into escrow and start the job. */
export async function markHeld(admin: Admin, paymentRowId: string, providerPaymentId: string, transferId: string | null) {
  const { data: pay } = await admin.from("payments").select("*").eq("id", paymentRowId).maybeSingle();
  if (!pay) return;
  if (pay.status !== "Pending" && pay.status !== "Paid_captured") return;
  await admin
    .from("payments")
    .update({
      status: "Held_in_escrow",
      provider_payment_id: providerPaymentId,
      provider_transfer_id: transferId ?? pay.provider_transfer_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pay.id);
  const { data: job } = await admin
    .from("jobs")
    .update({ status: "Job_Started", started_at: new Date().toISOString() })
    .eq("id", pay.job_id)
    .select("*")
    .single();
  if (!job) return;
  await admin.from("problems").update({ status: "Job_Started" }).eq("id", job.problem_id);
  await admin.from("conversations").upsert({ job_id: job.id }, { onConflict: "job_id" });
  await enqueue(admin, pay.expert_id, ["in_app", "push", "sms"], "Payment secured in escrow. You can start the job.");
  await enqueue(admin, pay.customer_id, ["in_app", "email"], "Payment held safely in escrow. Your expert is on the way.");
}
