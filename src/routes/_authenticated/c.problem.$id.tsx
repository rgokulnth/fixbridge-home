import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/c/problem/$id")({
  head: () => ({ meta: [{ title: "Problem details — FixBridge" }] }),
  component: () => (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold">Problem details</h1>
      <p className="mt-2 text-muted-foreground">This screen is coming next.</p>
    </div>
  ),
});
