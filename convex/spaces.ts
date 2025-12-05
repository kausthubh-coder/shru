import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { mustGetCurrentUser } from "./users";
import { Doc, Id } from "./_generated/dataModel";

const ideFileValidator = v.object({
  name: v.string(),
  language: v.string(),
  content: v.string(),
});

export const getWhiteboard = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await assertSessionOwnership(ctx, args.sessionId);
    return await getWhiteboardDoc(ctx, args.sessionId);
  },
});

export const updateWhiteboard = mutation({
  args: {
    sessionId: v.id("sessions"),
    snapshot: v.any(),
    schemaVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertSessionOwnership(ctx, args.sessionId);
    const row = await getWhiteboardDoc(ctx, args.sessionId);
    const payload: Partial<Doc<"whiteboard_sessions">> = {
      snapshot: args.snapshot,
      updatedAt: Date.now(),
    };
    if (typeof args.schemaVersion === "number") {
      payload.schemaVersion = args.schemaVersion;
    }

    if (row) {
      await ctx.db.patch(row._id, payload);
    } else {
      await ctx.db.insert("whiteboard_sessions", {
        sessionId: args.sessionId,
        snapshot: args.snapshot,
        schemaVersion: args.schemaVersion,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getIde = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await assertSessionOwnership(ctx, args.sessionId);
    return await ctx.db
      .query("ide_sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
  },
});

export const updateIde = mutation({
  args: {
    sessionId: v.id("sessions"),
    files: v.array(ideFileValidator),
    activeFile: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertSessionOwnership(ctx, args.sessionId);
    const row = await ctx.db
      .query("ide_sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (row) {
      await ctx.db.patch(row._id, {
        files: args.files,
        activeFile: args.activeFile,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("ide_sessions", {
        sessionId: args.sessionId,
        files: args.files,
        activeFile: args.activeFile,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getLesson = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await assertSessionOwnership(ctx, args.sessionId);
    return await ctx.db
      .query("lesson_sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
  },
});

export const updateLesson = mutation({
  args: {
    sessionId: v.id("sessions"),
    yaml: v.string(),
  },
  handler: async (ctx, args) => {
    await assertSessionOwnership(ctx, args.sessionId);
    const row = await ctx.db
      .query("lesson_sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (row) {
      await ctx.db.patch(row._id, {
        yaml: args.yaml,
        version: row.version + 1,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("lesson_sessions", {
        sessionId: args.sessionId,
        yaml: args.yaml,
        version: 1,
        updatedAt: Date.now(),
      });
    }
  },
});

export const listVersions = query({
  args: { spaceId: v.id("sessions") },
  returns: v.array(
    v.object({
      _id: v.id("sessions"),
      createdAt: v.number(),
      createdBy: v.string(),
      content: v.any(),
    }),
  ),
  handler: async () => {
    return [];
  },
});

export const saveVersion = mutation({
  args: { spaceId: v.id("sessions") },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});

type AnyCtx = QueryCtx | MutationCtx;

async function assertSessionOwnership(ctx: AnyCtx, sessionId: Id<"sessions">) {
  const user = await mustGetCurrentUser(ctx);
  const session = await ctx.db.get(sessionId);
  if (!session || session.ownerId !== user._id) {
    throw new Error("Session not found");
  }
  return session;
}

async function getWhiteboardDoc(ctx: AnyCtx, sessionId: Id<"sessions">) {
  return await ctx.db
    .query("whiteboard_sessions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
}
