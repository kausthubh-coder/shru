import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

function ensureEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`missing environment variable ${name}`);
  }
  return value;
}

const webhookSecret = ensureEnvironmentVariable("CLERK_WEBHOOK_SECRET");

const handleClerkWebhook = httpAction(async (ctx, request) => {
  const event = await validateRequest(request);
  if (!event) {
    return new Response("Error occured", {
      status: 400,
    });
  }
  switch (event.type) {
    case "user.created": // intentional fallthrough
    case "user.updated": {
      const existingUser = await ctx.runQuery(internal.users.getUser, {
        subject: event.data.id,
      });
      if (existingUser && event.type === "user.created") {
        console.warn("Overwriting user", event.data.id, "with", event.data);
      }
      console.log("creating/updating user", event.data.id);
      await ctx.runMutation(internal.users.updateOrCreateUser, {
        clerkUser: event.data,
      });
      break;
    }
    case "user.deleted": {
      // Clerk docs say this is required, but the types say optional?
      const id = event.data.id!;
      await ctx.runMutation(internal.users.deleteUser, { id });
      break;
    }
    default: {
      console.log("ignored Clerk webhook event", event.type);
    }
  }
  return new Response(null, {
    status: 200,
  });
});

const http = httpRouter();

async function validateRequest(
  req: Request
): Promise<WebhookEvent | undefined> {
  const payloadString = await req.text();

  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(webhookSecret);
  let evt: Event | null = null;
  try {
    evt = wh.verify(payloadString, svixHeaders) as Event;
  } catch (_) {
    console.log("error verifying");
    return;
  }

  return evt as unknown as WebhookEvent;
}

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: handleClerkWebhook,
});

// CORS helper
function corsHeaders(origin: string | null) {
  const allowOrigin = origin ?? process.env.CLIENT_ORIGIN ?? "*";
  return new Headers({
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  });
}

// Preflight for /realtime/token
http.route({
  path: "/realtime/token",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { headers: corsHeaders(request.headers.get("Origin")) });
  }),
});

// GET /realtime/token -> { value: ek_... }
http.route({
  path: "/realtime/token",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Optional: check auth via ctx.auth.getUserIdentity()
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) return new Response("Unauthorized", { status: 401, headers: corsHeaders(request.headers.get("Origin")) });

    try {
      const result = await ctx.runAction((internal as any).realtime.mintClientSecret, {
        model: "gpt-realtime",
        voice: "marin",
      });
      const headers = corsHeaders(request.headers.get("Origin"));
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (e: any) {
      const headers = corsHeaders(request.headers.get("Origin"));
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers });
    }
  }),
});

export default http;
