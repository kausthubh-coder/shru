import { AgentRuntime } from "../types/toolContracts";

type BuildRuntimeParams = {
  editorRef: React.MutableRefObject<any>;
  sessionRef: React.MutableRefObject<any>;
  appendLog?: (line: string) => void;
  onToolEvent?: (e: any) => void;
  setToolBusy?: (busy: boolean) => void;
  createFile: (name: string, language: string, content: string) => void;
  setActiveFileIdByName: (name: string) => boolean;
  updateActiveFileContent: (content: string) => void;
  listFilesContext: () => { files: Array<{ name: string; language: string; size: number }>; active?: string };
  getScreenshot: () => Promise<string | null>;
  getViewContext: () => any;
  dispatchAction: (action: any) => Promise<void>;
  getSimpleShape: (shapeId: string) => any | null;
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
      dispatchAction: async (action: any) => { await dispatchAction(action); },
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
    },
    notes: {
      getText: () => notesGetText(),
      setText: (text) => notesSetText(String(text ?? "")),
      append: (text) => notesAppend(String(text ?? "")),
    },
    sendTransportEvent: (evt: any) => { sessionRef.current?.transport?.sendEvent?.(evt); },
    appendLog,
    onToolEvent,
    setToolBusy,
  };
}


