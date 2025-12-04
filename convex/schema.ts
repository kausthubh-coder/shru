import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const spaceType = v.union(
  v.literal("whiteboard"),
  v.literal("ide"),
  v.literal("lesson"),
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  sessions: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    createdAt: v.number(),
    spaceTypes: v.array(spaceType),
  }).index("by_owner", ["ownerId", "createdAt"]),

  whiteboard_sessions: defineTable({
    sessionId: v.id("sessions"),
    snapshot: v.any(),
    schemaVersion: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_session", ["sessionId"]),

  ide_sessions: defineTable({
    sessionId: v.id("sessions"),
    files: v.array(
      v.object({
    name: v.string(),
        language: v.string(),
        content: v.string(),
      }),
    ),
    activeFile: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_session", ["sessionId"]),

  lesson_sessions: defineTable({
    sessionId: v.id("sessions"),
    yaml: v.string(),
    version: v.number(),
    updatedAt: v.number(),
  }).index("by_session", ["sessionId"]),
});
