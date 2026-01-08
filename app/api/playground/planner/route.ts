import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";

const ReqSchema = z.object({
  model: z.string().min(1),
  system: z.string().default(""),
  userText: z.string().default(""),
  contextText: z.string().default(""),
  contextImageUrl: z.string().nullable().optional(),
  toolHelp: z.string().default(""),
  maxToolCalls: z.number().int().min(0).max(20).default(8),
});

const ToolCallSchema = z.object({
  name: z.string().min(1),
  args: z.unknown().default({}),
});

const ResSchema = z.object({
  voiceScript: z.string().default(""),
  toolCalls: z.array(ToolCallSchema).default([]),
  debug: z
    .object({
      model: z.string().optional(),
    })
    .optional(),
});

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = ReqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      model,
      system,
      userText,
      contextText,
      contextImageUrl,
      toolHelp,
      maxToolCalls,
    } = parsed.data;

    const openrouter = createOpenAI({
      apiKey: requireEnv("OPENROUTER_API_KEY"),
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        // Recommended by OpenRouter for analytics/attribution. Optional.
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "shruai-test-app-playground",
      },
    });

    const planningSystem = [
      "You are a fast planning + tool-calling agent for a tutor playground.",
      "You do NOT speak to the user directly. Instead you return:",
      "- voiceScript: what the voice agent should say (concise, friendly).",
      "- toolCalls: a JSON array of tool calls to execute on the client.",
      "",
      "Rules:",
      `- Output MUST match the JSON schema (voiceScript + toolCalls).`,
      `- toolCalls length must be <= ${maxToolCalls}.`,
      "- If no tools are needed, return toolCalls: [].",
      "- Prefer fewer tool calls; be efficient.",
      "",
      toolHelp ? "Available tools:\n" + toolHelp : "",
      system ? "\nExtra system instructions:\n" + system : "",
    ]
      .filter(Boolean)
      .join("\n");

    const promptParts: Array<string> = [];
    if (userText) promptParts.push(`User said:\n${userText}`);
    if (contextText) promptParts.push(`Workspace context (JSON):\n${contextText}`);
    if (contextImageUrl) {
      // We don't transmit the image bytes here; the client already holds it.
      // This marker helps models reason that an image exists (and to ask for it if needed in future iterations).
      promptParts.push(`Workspace screenshot: (provided as data URL on client; not embedded here)`);
    }
    const prompt = promptParts.join("\n\n").slice(0, 60_000);

    const result = await generateObject({
      model: openrouter(model),
      system: planningSystem,
      prompt,
      schema: ResSchema,
    });

    return NextResponse.json(
      {
        ...result.object,
        debug: { model },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


