import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

export const SKILLS = ["plumbing", "electrical", "water-pump", "carpentry", "appliance", "painting", "ac-repair", "cleaning"] as const;

/** FixBridge diagnostic playbook (replace with the Hops playbook text when available). */
export const PLAYBOOK = `You are FixBridge's home-repair triage engineer for Indian households.
Follow this playbook:
1. Identify the most likely ROOT CAUSE from the customer's description (and category). Be specific (e.g. "dry-run damaged impeller", "capacitor failure", "air lock in suction line", "tripped MCB due to earth leakage").
2. Map to exactly ONE required skill from: ${SKILLS.join(", ")}.
   - Motor/pump/borewell/submersible/pressure/tank-filling issues -> water-pump.
   - Leaks, taps, pipes, drainage, geysers plumbing side -> plumbing.
   - Wiring, MCB, switches, sockets, inverter, earthing -> electrical.
3. DIFFICULTY: Easy (<1h, no parts), Medium (1-3h or common parts), Hard (specialised tools, motor rewinding, wall breaking).
4. ESTIMATED COST in INR, realistic Tier-2 Indian city labour + common parts. Consider budget hints but do not just copy them.
5. SAFETY: give one short safety instruction the customer should follow until the expert arrives (e.g. switch off pump at mains).
Never invent facts not supported by the description; when unclear, pick the most common cause and say so.`;

const analysisSchema = z.object({
  root_cause: z.string(),
  required_skill: z.enum(SKILLS),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  estimated_cost: z.number(),
  safety_notes: z.string(),
});
export type Analysis = z.infer<typeof analysisSchema>;

export async function runProblemAnalysis(input: {
  title: string;
  description: string;
  category: string;
  urgency: string;
  budget_min: number | null;
  budget_max: number | null;
}): Promise<Analysis> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: PLAYBOOK,
    prompt: `Category: ${input.category}\nUrgency: ${input.urgency}\nBudget: ${input.budget_min ?? "?"}-${input.budget_max ?? "?"} INR\nTitle: ${input.title}\nDescription: ${input.description}`,
    output: Output.object({ schema: analysisSchema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const out = await result.output;
  return analysisSchema.parse(out);
}
