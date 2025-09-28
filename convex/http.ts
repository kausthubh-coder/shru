import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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
