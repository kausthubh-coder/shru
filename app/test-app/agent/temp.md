
### Test utils: fake runtime
Create `tests/utils/makeRuntime.ts`:
```ts
import type { AgentRuntime } from "../../app/test-app/types/toolContracts";

export function makeRuntime(): AgentRuntime {
  const actions: any[] = [];
  const files: Array<{ name: string; language: string; content: string }> = [];
  let active: string | undefined;
  let notesText = "title: Notes\nversion: 1\nblocks: []\n";

  return {
    whiteboard: {
      dispatchAction: async (action: any) => { actions.push(action); },
      getViewContext: () => ({ viewport: { x: 0, y: 0, w: 100, h: 100 }, counts: {} }),
      getScreenshot: async () => "data:image/jpeg;base64,AAA",
      getSimpleShape: (_id: string) => ({ x: 10, y: 20, w: 100, h: 100 }),
      getVisibleTextItems: () => [],
    },
    ide: {
      createFile: (name, language, content) => { files.push({ name, language, content }); if (!active) active = name; },
      setActiveByName: (name) => { const ok = files.some(f => f.name === name); if (ok) active = name; return ok; },
      updateActiveContent: (content) => { const f = files.find(f => f.name === active); if (f) f.content = content; },
      getContext: () => ({ files: files.map(f => ({ name: f.name, language: f.language, size: f.content.length })), active }),
    },
    notes: {
      getText: () => notesText,
      setText: (t: string) => { notesText = t; },
      append: (t: string) => { notesText += t; },
    },
    sendTransportEvent: (_evt: any) => {},
    appendLog: (_line: string) => {},
    onToolEvent: (_e: any) => {},
    setToolBusy: (_b: boolean) => {},
  };
}
```

### Unit tests: whiteboard tools
Create `app/test-app/agent/tools/whiteboard.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { buildWhiteboardTools } from "./whiteboard";
import { makeRuntime } from "../../../tests/utils/makeRuntime";

function getTool(defs: any[], name: string) { return defs.find(d => d.name === name)!; }

describe("whiteboard tools", () => {
  it("agent_create coerces geo and dispatches create", async () => {
    const rt = makeRuntime();
    const spy = vi.spyOn(rt.whiteboard, "dispatchAction");
    const defs = buildWhiteboardTools(rt);
    await getTool(defs, "agent_create").execute({ geo: "circle", x: 5, y: 6, w: 10, h: 11, color: "black", fill: "none" });
    const call = spy.mock.calls[0][0];
    expect(call._type).toBe("create");
    expect(call.shape._type).toBe("ellipse"); // circle -> ellipse
  });

  it("agent_create errors on invalid position/size", async () => {
    const rt = makeRuntime();
    const defs = buildWhiteboardTools(rt);
    const res = await getTool(defs, "agent_create").execute({ geo: "rectangle", x: NaN, y: 0, w: 10, h: 10, color: "black", fill: "none" });
    expect(res.status).toBe("error");
    expect(res.summary).toMatch(/invalid position/);
  });

  it("agent_clear requests approval and does not clear by default", async () => {
    const rt = makeRuntime();
    const spyDispatch = vi.spyOn(rt.whiteboard, "dispatchAction");
    const spyEvents = vi.spyOn(rt, "onToolEvent");
    const defs = buildWhiteboardTools(rt);
    const res = await getTool(defs, "agent_clear").execute({});
    expect(res.status).toBe("error");
    expect(res.summary).toBe("approval_required");
    expect(spyDispatch).not.toHaveBeenCalled();
    // approval event emitted (custom rid)
    expect(spyEvents).toHaveBeenCalledWith(expect.objectContaining({ name: "agent_clear", rid: "approval", status: "start" }));
  });

  it("agent_send_view_image emits transport events and triggers response", async () => {
    const rt = makeRuntime();
    const spy = vi.spyOn(rt, "sendTransportEvent");
    const defs = buildWhiteboardTools(rt);
    const res = await getTool(defs, "agent_send_view_image").execute({});
    expect(res.status).toBe("ok");
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "conversation.item.create" }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "response.create" }));
  });
});
```

### Unit tests: notes tools
Create `app/test-app/agent/tools/notes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildNotesTools } from "./notes";
import { makeRuntime } from "../../../tests/utils/makeRuntime";

function getTool(defs: any[], name: string) { return defs.find(d => d.name === name)!; }

describe("notes tools", () => {
  it("notes_append_block_yaml rejects duplicate ids for interactive blocks", async () => {
    const rt = makeRuntime();
    // seed existing YAML with a quiz id
    await getTool(buildNotesTools(rt), "notes_set_yaml").execute({
      yaml: [
        "title: T", "version: 1", "blocks:", "  - type: quiz", "    id: quiz-1", "    title: Q", "    questions: []"
      ].join("\n")
    });
    const defs = buildNotesTools(rt);
    const res = await getTool(defs, "notes_append_block_yaml").execute({
      blockYaml: ["type: quiz", "id: quiz-1", "title: New", "questions: []"].join("\n")
    });
    expect(res.status).toBe("error");
    expect(res.summary).toMatch(/duplicate id: quiz-1/);
  });
});
```

### Unit tests: IDE tools
Create `app/test-app/agent/tools/ide.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildIdeTools } from "./ide";
import { makeRuntime } from "../../../tests/utils/makeRuntime";

function getTool(defs: any[], name: string) { return defs.find(d => d.name === name)!; }

describe("ide tools", () => {
  it("create/setActive/update/getContext flows", async () => {
    const rt = makeRuntime();
    const defs = buildIdeTools(rt);
    await getTool(defs, "ide_create_file").execute({ name: "a.py", language: "python", content: "print(1)" });
    await getTool(defs, "ide_set_active").execute({ name: "a.py" });
    await getTool(defs, "ide_update_content").execute({ content: "print(2)" });
    const ctxJson = await getTool(defs, "ide_get_context").execute({});
    const ctx = JSON.parse(ctxJson);
    expect(ctx.active).toBe("a.py");
    expect(ctx.files[0]).toEqual(expect.objectContaining({ name: "a.py", language: "python", size: 8 }));
  });
});
```

### Unit tests: wrapper telemetry
Create `app/test-app/types/toolContracts.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createWrapExecute, type AgentRuntime } from "./toolContracts";

function rt(): AgentRuntime {
  return {
    whiteboard: {} as any, ide: {} as any, notes: {} as any,
    appendLog: vi.fn(), onToolEvent: vi.fn(), setToolBusy: vi.fn(),
    sendTransportEvent: undefined,
  };
}

describe("createWrapExecute", () => {
  it("emits start/done and toggles busy", async () => {
    const runtime = rt();
    const wrap = createWrapExecute(runtime);
    const fn = wrap("t", async ({ x }: any) => ({ status: "ok", summary: String(x) }));
    const res = await fn({ x: 1 });
    expect(res).toEqual({ status: "ok", summary: "1" });
    expect(runtime.setToolBusy).toHaveBeenCalledWith(true);
    expect(runtime.setToolBusy).toHaveBeenCalledWith(false);
    expect(runtime.onToolEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "t", status: "start" }));
    expect(runtime.onToolEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "t", status: "done" }));
  });

  it("emits error and clears busy", async () => {
    const runtime = rt();
    const wrap = createWrapExecute(runtime);
    const fn = wrap("bad", async () => { throw new Error("nope"); });
    await expect(fn({})).rejects.toThrow("nope");
    expect(runtime.onToolEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "bad", status: "error" }));
    expect(runtime.setToolBusy).toHaveBeenCalledWith(false);
  });
});
```

### Schema/parameter validation checks
You can assert the Zod validators independently (without the SDK) to catch mismatched shapes early:
```ts
import { buildWhiteboardTools } from "../tools/whiteboard";

it("parameters schema rejects missing required fields", () => {
  const defs = buildWhiteboardTools({} as any);
  const t = defs.find(d => d.name === "agent_create")!;
  expect(() => t.parameters.parse({ geo: "rectangle" })).toThrow(); // x,y required
});
```

### Integration test (all tools wired together)
Create `app/test-app/agent/registry.int.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildAllTools } from "./registry";
import { makeRuntime } from "../../tests/utils/makeRuntime";

describe("tool registry", () => {
  it("builds tools and executes a common flow", async () => {
    const rt = makeRuntime();
    // Identity toolFn (SDK wrapper not needed here)
    const defs = buildAllTools((d) => d, rt);
    const get = (n: string) => defs.find((d: any) => d.name === n)!;

    await get("agent_create").execute({ geo: "rectangle", x: 0, y: 0, w: 100, h: 50, color: "black", fill: "none" });
    const ctx = await get("ide_get_context").execute({});
    expect(JSON.parse(ctx)).toHaveProperty("files");
    const img = await get("agent_capture_view_image").execute({});
    expect(img).toMatch(/^data:image\/jpeg;base64,/);
  });
});
```