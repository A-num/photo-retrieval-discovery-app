import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/** AI mode is enabled only when a key is configured; otherwise the app runs on local analysis. */
export function hasClaude() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class ClaudeUnavailableError extends Error {}

interface StructuredCall<T extends z.ZodType> {
  system: string;
  /** Large, stable context placed before the per-request message and cached. */
  cachedContext?: string;
  user: string;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

/** One Claude call returning a schema-validated object. */
export async function callStructured<T extends z.ZodType>({
  system,
  cachedContext,
  user,
  schema,
  effort = "medium",
  maxTokens = 16000,
}: StructuredCall<T>): Promise<z.infer<T>> {
  if (!hasClaude()) throw new ClaudeUnavailableError("ANTHROPIC_API_KEY is not set");

  const systemBlocks: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: system }];
  if (cachedContext) {
    systemBlocks.push({
      type: "text",
      text: cachedContext,
      cache_control: { type: "ephemeral" },
    });
  }

  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    // Re-run declined requests on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system: systemBlocks,
    messages: [{ role: "user", content: user }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to analyze this content");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude response was truncated (max_tokens)");
  }
  if (!response.parsed_output) throw new Error("Claude returned no parseable output");
  return response.parsed_output as z.infer<T>;
}
