import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  users: defineTable({
    // this is UserJSON from @clerk/backend
    clerkUser: v.any(),
  }).index("by_clerk_id", ["clerkUser.id"]),
});
