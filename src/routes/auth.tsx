import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FixBridge" },
      { name: "description", content: "Sign in to FixBridge as a customer, expert or admin." },
      { property: "og:title", content: "Sign in — FixBridge" },
      { property: "og:description", content: "Sign in to FixBridge as a customer, expert or admin." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [role, setRole] = useState<"customer" | "expert">("customer");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);

  const done = () => navigate({ to: "/" });

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const fullPhone = "+91" + phone.replace(/\D/g, "").slice(-10);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Wrench className="size-5" />
        </span>
        <span className="font-display text-xl font-bold">FixBridge</span>
      </div>
      <h1 className="text-2xl font-bold">Vanakkam! 👋</h1>
      <p className="mt-1 text-muted-foreground">Sign in to fix your home problems.</p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
        {(["customer", "expert"] as const).map((r) => (
          <button key={r} onClick={() => setRole(r)} className={cn("rounded-xl py-2 text-sm font-semibold capitalize", role === r ? "bg-card shadow-sm" : "text-muted-foreground")}>
            I'm a{r === "expert" ? "n" : ""} {r}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <Input placeholder="Your name (new users)" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" />

        {method === "phone" ? (
          <>
            <div className="flex gap-2">
              <span className="grid h-12 place-items-center rounded-xl border px-3 text-sm">+91</span>
              <Input inputMode="numeric" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-xl" />
            </div>
            {otpSent && <Input inputMode="numeric" placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="h-12 rounded-xl" />}
            <Button
              className="h-12 w-full rounded-xl text-base"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (!otpSent) {
                    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone, options: { data: { role, name } } });
                    if (error) throw error;
                    setOtpSent(true);
                    toast.success("OTP sent");
                  } else {
                    const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: "sms" });
                    if (error) throw error;
                    done();
                  }
                })
              }
            >
              {otpSent ? "Verify OTP" : "Send OTP"}
            </Button>
          </>
        ) : (
          <>
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
            <Button
              className="h-12 w-full rounded-xl text-base"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (signup) {
                    const { data, error } = await supabase.auth.signUp({
                      email,
                      password,
                      options: { data: { role, name }, emailRedirectTo: window.location.origin },
                    });
                    if (error) throw error;
                    if (!data.session) toast.success("Check your email to confirm your account");
                    else done();
                  } else {
                    const { error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    done();
                  }
                })
              }
            >
              {signup ? "Create account" : "Sign in"}
            </Button>
            <button className="w-full text-sm text-muted-foreground" onClick={() => setSignup(!signup)}>
              {signup ? "Have an account? Sign in" : "New here? Create account"}
            </button>
          </>
        )}
      </div>

      <button className="mt-6 text-sm font-semibold text-primary" onClick={() => setMethod(method === "phone" ? "email" : "phone")}>
        {method === "phone" ? "Use email instead (admins)" : "Use phone OTP instead"}
      </button>
    </div>
  );
}
