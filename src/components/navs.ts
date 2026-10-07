import { Briefcase, Home, ListChecks, PlusCircle, Search, ShieldCheck, LayoutDashboard } from "lucide-react";
import type { NavItem } from "./app-shell";

export const customerNav: NavItem[] = [
  { to: "/c", label: "Home", icon: Home, exact: true },
  { to: "/c/post", label: "Post", icon: PlusCircle },
  { to: "/c/problems", label: "My Problems", icon: ListChecks },
];
export const expertNav: NavItem[] = [
  { to: "/e", label: "Available", icon: Search, exact: true },
  { to: "/e/jobs", label: "My Jobs", icon: Briefcase },
  { to: "/e/onboarding", label: "KYC", icon: ShieldCheck },
];
export const adminNav: NavItem[] = [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }];
