import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin dashboard — FixBridge" }] }),
  component: () => (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold">Admin dashboard</h1>
      <p className="mt-2 text-muted-foreground">This screen is coming next.</p>
    </div>
  ),
});
