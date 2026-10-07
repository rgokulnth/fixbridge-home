import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Placeholder payment flow (no gateway yet): accepting a quote marks the
// payment as Held_in_escrow directly. Swap for real checkout later.

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
async function isAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return !!data;
}

export const acceptQuoteHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quoteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: q } = await db.from("quotes").select("*, problems(*)").eq("id", data.quoteId).maybeSingle();
    const p = q?.problems as any;
    if (!q || !p || p.customer_id !== context.userId) throw new Error("Quote not found");
    const { data: existing } = await db.from("jobs").select("id").eq("problem_id", p.id).maybeSingle();
    if (existing) throw new Error("A job already exists for this problem");
    const { data: job, error } = await db
      .from("jobs")
      .insert({ problem_id: p.id, quote_id: q.id, expert_id: q.expert_id, customer_id: context.userId, status: "Assigned" })
      .select("*")
      .single();
    if (error || !job) throw new Error(error?.message ?? "Could not create job");
    const commission = Math.round(q.amount * 0.2);
    await db.from("payments").insert({
      job_id: job.id, customer_id: context.userId, expert_id: q.expert_id, provider: "razorpay",
      amount: q.amount, commission, status: "Held_in_escrow", provider_order_id: "placeholder",
    });
    await db.from("conversations").insert({ job_id: job.id });
    await db.from("quotes").update({ status: "Accepted" }).eq("id", q.id);
    await db.from("quotes").update({ status: "Rejected" }).eq("problem_id", p.id).neq("id", q.id);
    await db.from("problems").update({ status: "Payment_Held" }).eq("id", p.id);
    return { jobId: job.id };
  });

const EXPERT_STEPS = { On_the_way: "Payment_Held", Started: "Job_Started", Solved: "Solved" } as const;

export const expertSetJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid(), status: z.enum(["On_the_way", "Started", "Solved"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.expert_id !== context.userId) throw new Error("Job not found");
    const patch: any = { status: data.status };
    if (data.status === "Started") patch.started_at = new Date().toISOString();
    if (data.status === "Solved") patch.solved_at = new Date().toISOString();
    await db.from("jobs").update(patch).eq("id", job.id);
    await db.from("problems").update({ status: EXPERT_STEPS[data.status] }).eq("id", job.problem_id);
    return { ok: true };
  });

export const customerConfirmJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.customer_id !== context.userId) throw new Error("Job not found");
    if (job.status !== "Solved") throw new Error("Expert hasn't marked it solved yet");
    await db.from("jobs").update({ status: "Confirmed", confirmed_at: new Date().toISOString() }).eq("id", job.id);
    await db.from("payments").update({ status: "Release_pending" }).eq("job_id", job.id).eq("status", "Held_in_escrow");
    return { ok: true };
  });

export const customerDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid(), reason: z.string().min(5).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.customer_id !== context.userId) throw new Error("Job not found");
    await db.from("disputes").insert({ job_id: job.id, raised_by: context.userId, reason: data.reason });
    await db.from("jobs").update({ status: "Disputed" }).eq("id", job.id);
    await db.from("problems").update({ status: "Disputed" }).eq("id", job.problem_id);
    return { ok: true };
  });

export const adminReleasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const db = await admin();
    const { data: p } = await db.from("payments").select("*").eq("id", data.paymentId).single();
    if (!p || !["Held_in_escrow", "Release_pending"].includes(p.status)) throw new Error("Payment not releasable");
    await db.from("payments").update({ status: "Released_to_expert", updated_at: new Date().toISOString() }).eq("id", p.id);
    const { data: job } = await db.from("jobs").update({ status: "Completed" }).eq("id", p.job_id).select("problem_id").single();
    if (job) await db.from("problems").update({ status: "Payment_Done" }).eq("id", job.problem_id);
    return { ok: true, payout: p.amount - p.commission };
  });

export const adminKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ expertId: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const db = await admin();
    await db.from("experts").update({ kyc_status: data.approve ? "Verified" : "Failed" }).eq("id", data.expertId);
    return { ok: true };
  });

export const signedUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bucket: z.enum(["kyc-docs", "problem-media"]), paths: z.array(z.string()).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.paths.length) return { urls: [] as string[] };
    const { data: s } = await context.supabase.storage.from(data.bucket).createSignedUrls(data.paths, 3600);
    return { urls: (s ?? []).map((x: any) => x.signedUrl as string) };
  });
