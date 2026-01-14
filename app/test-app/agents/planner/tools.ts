import { z } from "zod";
import { tool } from "ai";

/**
 * Tool definitions for the planner agent
 * These are schema-only definitions sent to the model
 * Actual execution happens client-side with the runtime
 */

// Whiteboard tools
export const whiteboardTools = {
  agent_create_shape: tool({
    description:
      "Create a geometric shape on the whiteboard (rectangle, ellipse, triangle, etc.)",
    parameters: z.object({
      geo: z
        .enum([
          "rectangle",
          "ellipse",
          "triangle",
          "diamond",
          "pentagon",
          "hexagon",
          "octagon",
          "star",
          "rhombus",
          "oval",
          "trapezoid",
          "arrow-right",
          "arrow-left",
          "arrow-up",
          "arrow-down",
          "cloud",
          "heart",
          "x-box",
          "check-box",
        ])
        .default("rectangle")
        .describe("Shape type"),
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      w: z.number().default(100).describe("Width"),
      h: z.number().default(80).describe("Height"),
      color: z.string().default("black").describe("Stroke color"),
      fill: z
        .enum(["none", "tint", "solid", "pattern"])
        .default("none")
        .describe("Fill style"),
    }),
  }),

  agent_create_text: tool({
    description: "Create a text element on the whiteboard",
    parameters: z.object({
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      text: z.string().describe("Text content"),
      w: z.number().default(220).describe("Width"),
      h: z.number().default(60).describe("Height"),
      color: z.string().default("black").describe("Text color"),
    }),
  }),

  agent_label: tool({
    description: "Attach or place a text label near an existing shape",
    parameters: z.object({
      shapeId: z.string().describe("ID of the shape to label"),
      text: z.string().describe("Label text"),
    }),
  }),

  agent_move: tool({
    description: "Move a shape to a new position",
    parameters: z.object({
      shapeId: z.string().describe("ID of the shape to move"),
      x: z.number().describe("New X coordinate"),
      y: z.number().describe("New Y coordinate"),
    }),
  }),

  agent_delete: tool({
    description: "Delete a shape from the whiteboard",
    parameters: z.object({
      shapeId: z.string().describe("ID of the shape to delete"),
    }),
  }),

  agent_clear: tool({
    description: "Clear all shapes from the whiteboard",
    parameters: z.object({}),
  }),

  agent_get_view_context: tool({
    description: "Get the current viewport and shapes context",
    parameters: z.object({}),
  }),

  agent_get_screenshot: tool({
    description: "Get a screenshot of the current viewport",
    parameters: z.object({}),
  }),
};

// IDE tools
export const ideTools = {
  ide_create_file: tool({
    description: "Create a new file in the IDE",
    parameters: z.object({
      name: z.string().describe("File name with extension (e.g., main.py)"),
      language: z.string().default("python").describe("Programming language"),
      content: z.string().default("").describe("Initial file content"),
    }),
  }),

  ide_update_file: tool({
    description: "Update the content of the active file",
    parameters: z.object({
      content: z.string().describe("New file content"),
    }),
  }),

  ide_run: tool({
    description: "Run the active Python file and get output",
    parameters: z.object({}),
  }),

  ide_get_context: tool({
    description: "Get list of files and active file info",
    parameters: z.object({}),
  }),
};

// Notes tools
export const notesTools = {
  notes_get: tool({
    description: "Get the current notes content",
    parameters: z.object({}),
  }),

  notes_set: tool({
    description: "Set the notes content (replaces existing)",
    parameters: z.object({
      text: z.string().describe("New notes content in YAML format"),
    }),
  }),

  notes_append: tool({
    description: "Append text to the notes",
    parameters: z.object({
      text: z.string().describe("Text to append"),
    }),
  }),
};

/**
 * All tools combined
 */
export const allPlannerTools = {
  ...whiteboardTools,
  ...ideTools,
  ...notesTools,
};

/**
 * Get tools for specific spaces
 */
export function getToolsForSpaces(
  spaces: Array<"whiteboard" | "ide" | "notes">,
) {
  const tools: Record<string, ReturnType<typeof tool>> = {};

  if (spaces.includes("whiteboard")) {
    Object.assign(tools, whiteboardTools);
  }
  if (spaces.includes("ide")) {
    Object.assign(tools, ideTools);
  }
  if (spaces.includes("notes")) {
    Object.assign(tools, notesTools);
  }

  return tools;
}
