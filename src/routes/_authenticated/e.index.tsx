import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/e/")({
  head: () => ({ meta: [{ title: "Expert jobs — FixBridge" }] }),
  component: () => (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold">Expert jobs</h1>
      <p className="mt-2 text-muted-foreground">This screen is coming next.</p>
    </div>
  ),
});
