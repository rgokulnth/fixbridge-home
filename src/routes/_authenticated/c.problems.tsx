import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, Pill, statusTone } from "@/components/app-shell";
import { customerNav } from "@/components/navs";
import { STATUS_LABEL } from "@/lib/session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/c/problems")({
  head: () => ({ meta: [{ title: "My problems — FixBridge" }, { name: "description", content: "Track all your posted problems." }] }),
  component: MyProblems,
});

function MyProblems() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-problems-all"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      return (await supabase.from("problems").select("id,title,status,category,created_at,quotes(count)").eq("customer_id", u.user!.id).order("created_at", { ascending: false })).data ?? [];
    },
  });
  return (
    <AppShell title="My problems" nav={customerNav}>
      <h1 className="mb-4 text-2xl font-bold">My problems</h1>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {data?.length === 0 && (
        <Empty title="No problems yet" hint="Post your first problem with a photo.">
          <Button asChild className="mt-2 rounded-xl"><Link to="/c/post">Post problem</Link></Button>
        </Empty>
      )}
      <div className="space-y-2">
        {data?.map((p: any) => (
          <Link key={p.id} to="/c/problem/$id" params={{ id: p.id }} className="card-surface flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                <span className="capitalize">{p.category}</span> · {p.quotes?.[0]?.count ?? 0} quotes · {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
            <Pill t={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Pill>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
