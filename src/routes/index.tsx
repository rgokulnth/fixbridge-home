import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { useMe, homeFor } from "@/lib/session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FixBridge — Home repairs with escrow protection" },
      { name: "description", content: "Post your problem with a photo, get quotes from verified local experts, pay safely held in escrow." },
      { property: "og:title", content: "FixBridge — Home repairs with escrow protection" },
      { property: "og:description", content: "Post your problem with a photo, get quotes from verified local experts, pay safely held in escrow." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  useEffect(() => {
    if (me) navigate({ to: homeFor(me.role), replace: true });
  }, [me, navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <div className="flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Wrench className="size-5" />
        </span>
        <span className="font-display text-xl font-bold">FixBridge</span>
      </div>
      <div className="mt-14 flex-1">
        <h1 className="text-4xl font-bold leading-tight">
          Veetla problem? <span className="text-primary">Fix pannalam.</span>
        </h1>
        <p className="mt-3 text-muted-foreground">Photo eduthu post pannunga. Verified experts quote anupuvaanga. Payment escrow-la safe-a irukkum.</p>
        <div className="mt-8 space-y-3">
          {[
            { icon: Sparkles, t: "AI diagnoses the problem instantly" },
            { icon: ShieldCheck, t: "KYC-verified experts near you" },
            { icon: Wrench, t: "Money released only after you confirm" },
          ].map((f) => (
            <div key={f.t} className="card-surface flex items-center gap-3 p-4">
              <f.icon className="size-5 text-primary" />
              <span className="text-sm font-medium">{f.t}</span>
            </div>
          ))}
        </div>
      </div>
      <Button asChild className="h-14 rounded-2xl text-base" disabled={isLoading}>
        <Link to="/auth">Get started</Link>
      </Button>
    </div>
  );
}
