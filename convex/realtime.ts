"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const mintClientSecret = internalAction({
  args: {
    model: v.optional(v.string()),
    voice: v.optional(v.string()),
  },
  returns: v.object({ value: v.string() }),
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const sessionConfig = {
      session: {
        type: "realtime",
        model: args.model ?? "gpt-realtime",
        audio: {
          output: { voice: args.voice ?? "marin" },
        },
      },
    };

    const resp = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI client_secrets error: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as { value: string };
    if (!data?.value) {
      throw new Error("Invalid client_secrets response");
    }
    return { value: data.value };
  },
});










