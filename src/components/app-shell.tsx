import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LogOut, Wrench } from "lucide-react";
import { useSignOut } from "@/lib/session";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

export function AppShell({ title, nav, children, action }: { title: string; nav: NavItem[]; children: ReactNode; action?: ReactNode }) {
  const signOut = useSignOut();
  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Wrench className="size-4" />
            </span>
            <span className="hidden sm:inline">FixBridge</span>
          </Link>
          <span className="truncate text-sm text-muted-foreground">{title}</span>
          <nav className="ml-auto hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: !!n.exact }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto md:ml-0 flex items-center gap-2">
            {action}
            <button onClick={signOut} aria-label="Sign out" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      <nav className="bottom-bar fixed inset-x-0 bottom-0 z-30 flex md:hidden">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: !!n.exact }}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
            activeProps={{ className: "text-brand" }}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const tone: Record<string, string> = {
  good: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning",
  bad: "bg-destructive/10 text-destructive",
  brand: "bg-brand-soft text-accent-foreground",
  muted: "bg-secondary text-muted-foreground",
};
export function Pill({ children, t = "muted", className }: { children: ReactNode; t?: keyof typeof tone; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tone[t], className)}>{children}</span>;
}

export function statusTone(s: string): keyof typeof tone {
  if (["Payment_Done", "Completed", "Released_to_expert", "Verified", "Sent", "Accepted"].includes(s)) return "good";
  if (["Disputed", "Cancelled", "Refunded", "Failed", "Rejected"].includes(s)) return "bad";
  if (["Job_Started", "Held_in_escrow", "Solved", "Expert_Solved", "Customer_Confirmed"].includes(s)) return "brand";
  if (["Quote_Sent", "Payment_Held", "Submitted", "Pending", "Queued"].includes(s)) return "warn";
  return "muted";
}

export function Empty({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="card-surface flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-display font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
