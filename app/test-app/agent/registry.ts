import { buildWhiteboardTools } from "./tools/whiteboard";
import { buildIdeTools } from "./tools/ide";
import { buildNotesTools } from "./tools/notes";
import { AgentRuntime } from "../types/toolContracts";

export function buildAllTools(toolFn: (def: any) => any, runtime: AgentRuntime) {
  const defs = [
    ...buildWhiteboardTools(runtime),
    ...buildIdeTools(runtime),
    ...buildNotesTools(runtime),
  ];
  return defs.map((d) => toolFn(d));
}


