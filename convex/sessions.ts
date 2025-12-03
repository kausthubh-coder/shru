import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { mustGetCurrentUser } from "./users";

const spaceType = v.union(
  v.literal("whiteboard"),
  v.literal("ide"),
  v.literal("lesson"),
);

export const create = mutation({
  args: {
    name: v.string(),
    initialSpaces: v.array(spaceType),
  },
  handler: async (ctx, args) => {
    const user = await mustGetCurrentUser(ctx);
    const uniqueSpaceTypes = Array.from(new Set(args.initialSpaces));

    const sessionId = await ctx.db.insert("sessions", {
      ownerId: user._id,
      title: args.name,
      createdAt: Date.now(),
      spaceTypes: uniqueSpaceTypes,
    });

    const now = Date.now();

    for (const type of uniqueSpaceTypes) {
      if (type === "whiteboard") {
        await ctx.db.insert("whiteboard_sessions", {
          sessionId,
          snapshot: defaultWhiteboardSnapshot(),
          updatedAt: now,
        });
      }

      if (type === "ide") {
        await ctx.db.insert("ide_sessions", {
          sessionId,
          files: [
            {
              name: "main.py",
              language: "python",
              content: "# Welcome!\nprint('Hello from your IDE space')\n",
            },
          ],
          activeFile: "main.py",
          updatedAt: now,
        });
      }

      if (type === "lesson") {
        await ctx.db.insert("lesson_sessions", {
          sessionId,
          yaml: defaultLessonYaml(),
          version: 1,
          updatedAt: now,
        });
      }
    }

    return sessionId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await mustGetCurrentUser(ctx);

    return await ctx.db
      .query("sessions")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const user = await mustGetCurrentUser(ctx);
    const session = await ctx.db.get(args.id);
    if (!session || session.ownerId !== user._id) return null;
    return session;
  },
});

function defaultWhiteboardSnapshot() {
  return null;
}

function defaultLessonYaml() {
  return [
    "title: Lesson",
    "version: 1",
    "blocks:",
    "  - type: text",
    "    md: \"Welcome to your lesson space\"",
  ].join("\n");
}
