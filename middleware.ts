import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

// Restrict middleware only to protected app routes to avoid intercepting Next static assets in dev
export const config = {
  matcher: ["/server/:path*"],
};
