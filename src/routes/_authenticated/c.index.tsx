import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, Zap, Droplets, Hammer, BrickWall, Paintbrush, Snowflake, Search, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Pill, statusTone } from "@/components/app-shell";
import { customerNav } from "@/components/navs";
import { STATUS_LABEL } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/c/")({
  head: () => ({ meta: [{ title: "Home — FixBridge" }, { name: "description", content: "Find a verified expert for any home problem." }] }),
  component: CustomerHome,
});

export const CATEGORIES = [
  { key: "electrical", label: "Electric", icon: Zap },
  { key: "plumbing", label: "Plumbing", icon: Droplets },
  { key: "carpentry", label: "Carpentry", icon: Hammer },
  { key: "mason", label: "Mason", icon: BrickWall },
  { key: "painting", label: "Painting", icon: Paintbrush },
  { key: "ac-repair", label: "AC", icon: Snowflake },
];

function CustomerHome() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data: problems } = useQuery({
    queryKey: ["my-problems"],
    queryFn: async () => (await supabase.from("problems").select("id,title,status,category,created_at").order("created_at", { ascending: false }).limit(5)).data ?? [],
  });

  return (
    <AppShell title="Home" nav={customerNav}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/c/post", search: { q } });
        }}
        className="relative"
      >
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Enna problem?" className="h-14 w-full rounded-2xl border bg-secondary pl-12 pr-4 text-base outline-none focus:ring-2 focus:ring-ring" />
      </form>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {CATEGORIES.map((c) => (
          <Link key={c.key} to="/c/post" search={{ category: c.key }} className="card-surface flex flex-col items-center gap-2 py-4">
            <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <c.icon className="size-5" />
            </span>
            <span className="text-sm font-semibold">{c.label}</span>
          </Link>
        ))}
      </div>

      <Link to="/c/post" className="mt-6 flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg">
        <Camera className="size-8 shrink-0" />
        <div>
          <p className="font-display text-lg font-bold">Photo Eduthu Problem Post Pannu</p>
          <p className="text-sm opacity-90">Experts will send quotes in minutes</p>
        </div>
      </Link>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold">My recent problems</h2>
        <Link to="/c/problems" className="text-sm font-semibold text-primary">See all</Link>
      </div>
      <div className="mt-3 space-y-2">
        {problems?.length === 0 && <p className="text-sm text-muted-foreground">No problems posted yet.</p>}
        {problems?.map((p) => (
          <Link key={p.id} to="/c/problem/$id" params={{ id: p.id }} className="card-surface flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.title}</p>
              <p className="text-xs capitalize text-muted-foreground">{p.category}</p>
            </div>
            <Pill t={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Pill>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
