import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type Role = "customer" | "expert" | "admin";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const list = (roles ?? []).map((r) => r.role as Role);
      const role: Role = list.includes("admin") ? "admin" : list.includes("expert") ? "expert" : "customer";
      return { user: data.user, role, roles: list };
    },
  });
}

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "expert" ? "/e" : "/c";
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
}

export const STATUS_LABEL: Record<string, string> = {
  Open: "Posted",
  AI_Analysed: "AI analysed",
  Expert_Matched: "Experts notified",
  Quote_Sent: "Quotes received",
  Payment_Held: "Awaiting payment",
  Job_Started: "In progress",
  Solved: "Marked solved",
  Payment_Done: "Completed",
  Disputed: "In dispute",
  Cancelled: "Refunded",
};

export const SKILL_OPTIONS = ["water-pump", "plumbing", "electrical", "carpentry", "appliance", "painting", "ac-repair", "cleaning"];

export function money(n: number | null | undefined, currency = "INR") {
  if (n == null) return "—";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
