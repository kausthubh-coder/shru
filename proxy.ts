import { clerkMiddleware } from "@clerk/nextjs/server";

export const proxy = clerkMiddleware();

// Restrict proxy only to protected app routes to avoid intercepting Next static assets in dev
export const config = {
  matcher: ["/server/:path*"],
};
