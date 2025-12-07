import { AgentRuntime, WhiteboardShape } from "../types/toolContracts";

type BuildRuntimeParams = {
  editorRef: React.MutableRefObject<unknown>;
  sessionRef: React.MutableRefObject<unknown>;
  appendLog?: (line: string) => void;
  onToolEvent?: (e: unknown) => void;
  setToolBusy?: (busy: boolean) => void;
  createFile: (name: string, language: string, content: string) => void;
  setActiveFileIdByName: (name: string) => boolean;
  updateActiveFileContent: (content: string) => void;
  listFilesContext: () => { files: Array<{ name: string; language: string; size: number }>; active?: string };
  getActiveFileSnapshot: () => { name: string; language: string; content: string } | null;
  runActiveFile: () => Promise<{ stdout: string; stderr: string; info: string[] }>;
  getScreenshot: () => Promise<string | null>;
  getViewContext: () => unknown;
  dispatchAction: (action: Record<string, unknown>) => Promise<void>;
  getSimpleShape: (shapeId: string) => WhiteboardShape | null;
  getVisibleTextItems: () => Array<{ shapeId: string; type: string; text: string; note?: string }>;
  notesGetText: () => string;
  notesSetText: (text: string) => void;
  notesAppend: (text: string) => void;
};

export function buildRuntime(params: BuildRuntimeParams): AgentRuntime {
  const {
    editorRef,
    sessionRef,
    appendLog,
    onToolEvent,
    setToolBusy,
    createFile,
    setActiveFileIdByName,
    updateActiveFileContent,
    listFilesContext,
    getActiveFileSnapshot,
    runActiveFile,
    getScreenshot,
    getViewContext,
    dispatchAction,
    getSimpleShape,
    getVisibleTextItems,
    notesGetText,
    notesSetText,
    notesAppend,
  } = params;

  return {
    whiteboard: {
      dispatchAction: async (action: Record<string, unknown>) => { await dispatchAction(action); },
      getViewContext: () => getViewContext(),
      getScreenshot: async () => await getScreenshot(),
      getSimpleShape: (shapeId: string) => getSimpleShape(shapeId),
      getVisibleTextItems: () => getVisibleTextItems(),
    },
    ide: {
      createFile: (name, language, content) => createFile(name, language, content),
      setActiveByName: (name) => setActiveFileIdByName(name),
      updateActiveContent: (content) => updateActiveFileContent(String(content ?? "")),
      getContext: () => listFilesContext(),
      getActiveContent: () => getActiveFileSnapshot(),
      runActive: () => runActiveFile(),
    },
    notes: {
      getText: () => notesGetText(),
      setText: (text) => notesSetText(String(text ?? "")),
      append: (text) => notesAppend(String(text ?? "")),
    },
    sendTransportEvent: (evt: unknown) => { 
      const s = sessionRef.current as { transport?: { sendEvent?: (evt: unknown) => void } };
      s?.transport?.sendEvent?.(evt); 
    },
    appendLog,
    onToolEvent,
    setToolBusy,
  };
}


