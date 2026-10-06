import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
async function isAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return !!data;
}

/** AI analysis + expert matching for a freshly posted problem. */
export const analyzeProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ problemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("problems").select("*").eq("id", data.problemId).maybeSingle();
    if (!p || (p.customer_id !== context.userId && !(await isAdmin(context)))) throw new Error("Problem not found");
    const { runProblemAnalysis } = await import("./ai.server");
    const { enqueue } = await import("./notify.server");
    const db = await admin();

    const a = await runProblemAnalysis(p);
    await db.from("ai_analyses").upsert(
      { problem_id: p.id, root_cause: a.root_cause, required_skill: a.required_skill, difficulty: a.difficulty, estimated_cost: Math.round(a.estimated_cost), safety_notes: a.safety_notes, raw: a },
      { onConflict: "problem_id" },
    );
    if (p.status === "Open") await db.from("problems").update({ status: "AI_Analysed" }).eq("id", p.id);

    const { data: experts } = await db.from("experts").select("id, skills, lat, long, radius_km, rating").eq("kyc_status", "Verified");
    const matches = (experts ?? [])
      .filter((e) => e.skills.includes(a.required_skill) || e.skills.includes(p.category))
      .map((e) => {
        const dist = p.lat != null && e.lat != null && p.long != null && e.long != null ? km(p.lat, p.long, e.lat, e.long) : null;
        return { e, dist };
      })
      .filter(({ e, dist }) => dist == null || dist <= e.radius_km)
      .map(({ e, dist }) => ({
        problem_id: p.id,
        expert_id: e.id,
        score: Math.round((Number(e.rating) * 15 + (e.skills.includes(a.required_skill) ? 40 : 20) + (dist == null ? 10 : Math.max(0, 30 - dist))) * 10) / 10,
      }))
      .sort((x, y) => y.score - x.score)
      .slice(0, 10);

    if (matches.length) {
      await db.from("expert_matches").upsert(matches, { onConflict: "problem_id,expert_id", ignoreDuplicates: true });
      await db.from("problems").update({ status: "Expert_Matched" }).eq("id", p.id).in("status", ["Open", "AI_Analysed"]);
      for (const m of matches) await enqueue(db, m.expert_id, ["in_app", "push", "sms"], `New ${a.required_skill} job near you: ${p.title}`);
    }
    return { analysis: a, matched: matches.length };
  });

/** Customer accepts a quote -> job + payment row + real checkout. */
export const acceptQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quoteId: z.string().uuid(), provider: z.enum(["razorpay", "stripe"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const pay = await import("./payments.server");
    const { data: q } = await db.from("quotes").select("*, problems(*)").eq("id", data.quoteId).maybeSingle();
    const problem = q?.problems as any;
    if (!q || !problem || problem.customer_id !== context.userId) throw new Error("Quote not found");
    if (!["Quote_Sent", "Expert_Matched", "AI_Analysed", "Open", "Payment_Held"].includes(problem.status)) throw new Error("This problem already has an active job");

    let { data: job } = await db.from("jobs").select("*").eq("problem_id", problem.id).maybeSingle();
    if (job && job.quote_id !== q.id) {
      if (job.status !== "Awaiting_payment") throw new Error("Job already started");
      await db.from("payments").delete().eq("job_id", job.id).eq("status", "Pending");
      await db.from("jobs").delete().eq("id", job.id);
      job = null;
    }
    if (!job) {
      const ins = await db.from("jobs").insert({ problem_id: problem.id, quote_id: q.id, expert_id: q.expert_id, customer_id: context.userId }).select("*").single();
      if (ins.error) throw new Error(ins.error.message);
      job = ins.data;
    }
    await db.from("quotes").update({ status: "Accepted" }).eq("id", q.id);
    await db.from("quotes").update({ status: "Rejected" }).eq("problem_id", problem.id).neq("id", q.id).eq("status", "Sent");
    await db.from("problems").update({ status: "Payment_Held" }).eq("id", problem.id);

    const { commission } = pay.split(q.amount);
    const { data: expert } = await db.from("experts").select("razorpay_account_id, stripe_account_id").eq("id", q.expert_id).single();
    await db.from("payments").delete().eq("job_id", job!.id).eq("status", "Pending");
    const { data: payRow, error } = await db
      .from("payments")
      .insert({ job_id: job!.id, customer_id: context.userId, expert_id: q.expert_id, provider: data.provider, currency: data.provider === "stripe" ? "USD" : "INR", amount: q.amount, commission })
      .select("*")
      .single();
    if (error || !payRow) throw new Error(error?.message ?? "Could not create payment");

    if (data.provider === "razorpay") {
      const o = await pay.razorpayCreateOrder({ amountInr: q.amount, receipt: payRow.id, expertAccount: expert?.razorpay_account_id ?? null });
      await db.from("payments").update({ provider_order_id: o.orderId }).eq("id", payRow.id);
      return { provider: "razorpay" as const, orderId: o.orderId, keyId: o.keyId, amount: q.amount * 100, paymentRowId: payRow.id, title: problem.title as string };
    }
    const origin = new URL(getRequest().url).origin;
    const s = await pay.stripeCreateCheckout({ amountUsd: q.amount, paymentRowId: payRow.id, title: problem.title, origin, problemId: problem.id });
    await db.from("payments").update({ provider_order_id: s.sessionId }).eq("id", payRow.id);
    return { provider: "stripe" as const, url: s.url };
  });

/** Razorpay Checkout success handler (signature verified server-side). */
export const confirmRazorpay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ paymentRowId: z.string().uuid(), orderId: z.string(), paymentId: z.string(), signature: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const pay = await import("./payments.server");
    const { markHeld } = await import("./escrow.server");
    const { data: row } = await db.from("payments").select("*").eq("id", data.paymentRowId).maybeSingle();
    if (!row || row.customer_id !== context.userId || row.provider_order_id !== data.orderId) throw new Error("Payment not found");
    if (!(await pay.razorpayVerifyCheckout(data.orderId, data.paymentId, data.signature))) throw new Error("Payment signature invalid");
    const transfer = await pay.razorpayFindTransfer(data.paymentId).catch(() => null);
    await markHeld(db, row.id, data.paymentId, transfer);
    return { ok: true };
  });

export const expertMarkSolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { enqueue } = await import("./notify.server");
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.expert_id !== context.userId) throw new Error("Job not found");
    if (job.status !== "Job_Started") throw new Error("Job is not in progress");
    await db.from("jobs").update({ status: "Expert_Solved", solved_at: new Date().toISOString() }).eq("id", job.id);
    await db.from("problems").update({ status: "Solved" }).eq("id", job.problem_id);
    await enqueue(db, job.customer_id, ["in_app", "push", "sms"], "Your expert marked the job as solved. Please confirm.");
    return { ok: true };
  });

export const customerConfirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.customer_id !== context.userId) throw new Error("Job not found");
    if (job.status !== "Expert_Solved") throw new Error("Expert hasn't marked this solved yet");
    await db.from("jobs").update({ status: "Customer_Confirmed", confirmed_at: new Date().toISOString() }).eq("id", job.id);
    return { ok: true };
  });

export const raiseDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid(), reason: z.string().min(5).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || (job.customer_id !== context.userId && job.expert_id !== context.userId)) throw new Error("Job not found");
    if (["Completed", "Refunded"].includes(job.status)) throw new Error("Job is closed");
    await db.from("disputes").insert({ job_id: job.id, raised_by: context.userId, reason: data.reason });
    await db.from("jobs").update({ status: "Disputed" }).eq("id", job.id);
    await db.from("problems").update({ status: "Disputed" }).eq("id", job.problem_id);
    return { ok: true };
  });

/** Admin approves -> release 80% to expert. */
export const adminRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const db = await admin();
    const pay = await import("./payments.server");
    const { enqueue } = await import("./notify.server");
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).single();
    if (!job || job.status !== "Customer_Confirmed") throw new Error("Customer has not confirmed this job");
    const { data: p } = await db.from("payments").select("*").eq("job_id", job.id).eq("status", "Held_in_escrow").single();
    if (!p || !p.provider_payment_id) throw new Error("No escrowed payment");
    const { data: ex } = await db.from("experts").select("razorpay_account_id, stripe_account_id").eq("id", job.expert_id).single();
    const payout = p.amount - p.commission;
    let transferId: string | null;
    if (p.provider === "razorpay") {
      transferId = await pay.razorpayRelease({ paymentId: p.provider_payment_id, transferId: p.provider_transfer_id, expertAccount: ex?.razorpay_account_id ?? null, payoutInr: payout });
    } else {
      const charge = await pay.stripeLatestCharge(p.provider_payment_id);
      transferId = await pay.stripeRelease({ chargeId: charge, account: ex?.stripe_account_id ?? null, payoutUsd: payout, group: p.id });
    }
    await db.from("payments").update({ status: "Released_to_expert", provider_transfer_id: transferId, updated_at: new Date().toISOString() }).eq("id", p.id);
    await db.from("jobs").update({ status: "Completed" }).eq("id", job.id);
    await db.from("problems").update({ status: "Payment_Done" }).eq("id", job.problem_id);
    await enqueue(db, job.expert_id, ["in_app", "push", "sms", "email"], `Payout of ${payout} released to your account.`);
    return { ok: true };
  });

export const adminResolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ disputeId: z.string().uuid(), action: z.enum(["refund", "reject"]), note: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const db = await admin();
    const pay = await import("./payments.server");
    const { enqueue } = await import("./notify.server");
    const { data: d } = await db.from("disputes").select("*, jobs(*)").eq("id", data.disputeId).single();
    if (!d || d.status !== "Open") throw new Error("Dispute already resolved");
    const job = d.jobs as any;
    if (data.action === "refund") {
      const { data: p } = await db.from("payments").select("*").eq("job_id", job.id).in("status", ["Held_in_escrow", "Paid_captured"]).maybeSingle();
      if (p?.provider_payment_id) {
        if (p.provider === "razorpay") await pay.razorpayRefund(p.provider_payment_id, p.provider_transfer_id);
        else await pay.stripeRefund(p.provider_payment_id);
        await db.from("payments").update({ status: "Refunded", updated_at: new Date().toISOString() }).eq("id", p.id);
      }
      await db.from("jobs").update({ status: "Refunded" }).eq("id", job.id);
      await db.from("problems").update({ status: "Cancelled" }).eq("id", job.problem_id);
      await enqueue(db, job.customer_id, ["in_app", "sms", "email"], "Your dispute was accepted and the payment refunded.");
    } else {
      const back = job.solved_at ? "Expert_Solved" : "Job_Started";
      await db.from("jobs").update({ status: back }).eq("id", job.id);
      await db.from("problems").update({ status: back === "Expert_Solved" ? "Solved" : "Job_Started" }).eq("id", job.problem_id);
    }
    await db.from("disputes").update({ status: data.action === "refund" ? "Refunded" : "Rejected", resolution: data.note ?? null }).eq("id", d.id);
    return { ok: true };
  });

export const adminSetKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      expertId: z.string().uuid(),
      status: z.enum(["Verified", "Failed"]),
      note: z.string().max(500).optional(),
      razorpayAccountId: z.string().max(64).optional(),
      stripeAccountId: z.string().max(64).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const db = await admin();
    const { enqueue } = await import("./notify.server");
    const patch: any = { kyc_status: data.status, kyc_note: data.note ?? null };
    if (data.razorpayAccountId) patch["razorpay_account_id"] = data.razorpayAccountId;
    if (data.stripeAccountId) patch["stripe_account_id"] = data.stripeAccountId;
    if (data.razorpayAccountId || data.stripeAccountId) patch["payout_status"] = "Active";
    await db.from("experts").update(patch).eq("id", data.expertId);
    await enqueue(db, data.expertId, ["in_app", "sms"], data.status === "Verified" ? "Your KYC is verified. You can now quote on jobs!" : `KYC needs attention: ${data.note ?? "please re-upload documents"}`);
    return { ok: true };
  });

export const adminSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bucket: z.enum(["kyc-docs", "problem-media"]), path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.storage.from(data.bucket).createSignedUrl(data.path, 600);
    return { url: s?.signedUrl ?? null };
  });

export const retryMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { dispatchForUser } = await import("./notify.server");
    await dispatchForUser(await admin(), context.userId);
    return { ok: true };
  });
