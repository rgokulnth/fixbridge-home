// Queue-then-send notifications. Rows are inserted as Queued; each provider
// flips them to Sent only after a real 2xx from Twilio / Resend / OneSignal.
// When a provider's keys are missing, the row stays Queued with a reason.

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
export type Channel = "in_app" | "push" | "email" | "sms";

export async function enqueue(admin: Admin, userId: string, channels: Channel[], message: string) {
  const { data } = await admin
    .from("notifications")
    .insert(channels.map((type) => ({ user_id: userId, type, message })))
    .select("id");
  await dispatchForUser(admin, userId, (data ?? []).map((d) => d.id));
}

export async function dispatchForUser(admin: Admin, userId: string, ids?: string[]) {
  let q = admin.from("notifications").select("*").eq("user_id", userId).eq("status", "Queued");
  if (ids && ids.length) q = q.in("id", ids);
  const { data: rows } = await q;
  if (!rows?.length) return;
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const phone = u.user?.phone ? `+${u.user.phone.replace(/^\+/, "")}` : null;
  const email = u.user?.email ?? null;

  for (const n of rows) {
    let ok = false;
    let error: string | null = null;
    try {
      if (n.type === "in_app") ok = true;
      else if (n.type === "sms") [ok, error] = await sendSms(phone, n.message);
      else if (n.type === "email") [ok, error] = await sendEmail(email, n.message);
      else if (n.type === "push") [ok, error] = await sendPush(userId, n.message);
    } catch (e) {
      error = e instanceof Error ? e.message : "send failed";
    }
    await admin
      .from("notifications")
      .update(ok ? { status: "Sent", sent_at: new Date().toISOString(), error: null } : { error })
      .eq("id", n.id);
  }
}

async function sendSms(to: string | null, body: string): Promise<[boolean, string | null]> {
  const sid = process.env["TWILIO_ACCOUNT_SID"], token = process.env["TWILIO_AUTH_TOKEN"], from = process.env["TWILIO_FROM_NUMBER"];
  if (!sid || !token || !from) return [false, "Twilio not configured"];
  if (!to) return [false, "No phone on account"];
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: `FixBridge: ${body}` }),
  });
  return res.ok ? [true, null] : [false, `Twilio ${res.status}`];
}

async function sendEmail(to: string | null, text: string): Promise<[boolean, string | null]> {
  const key = process.env["RESEND_API_KEY"], from = process.env["RESEND_FROM_EMAIL"];
  if (!key || !from) return [false, "Resend not configured"];
  if (!to) return [false, "No email on account"];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: "FixBridge update", text }),
  });
  return res.ok ? [true, null] : [false, `Resend ${res.status}`];
}

async function sendPush(userId: string, text: string): Promise<[boolean, string | null]> {
  const appId = process.env["ONESIGNAL_APP_ID"], key = process.env["ONESIGNAL_REST_API_KEY"];
  if (!appId || !key) return [false, "OneSignal not configured"];
  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      include_aliases: { external_id: [userId] },
      target_channel: "push",
      contents: { en: text },
    }),
  });
  return res.ok ? [true, null] : [false, `OneSignal ${res.status}`];
}
