"use client";

import React from "react";
import dynamic from "next/dynamic";
import { parseNotesYaml } from "../types/notesYaml";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function NotesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [local, setLocal] = React.useState<string>(value);

  React.useEffect(() => {
    setLocal(value);
  }, [value]);

  const errors = React.useMemo(() => parseNotesYaml(local).errors, [local]);

  return (
    <div className="h-full grid" style={{ gridTemplateRows: "auto 1fr auto" }}>
      <div className="h-8 flex items-center justify-between">
        <div className="text-sm font-medium">YAML (read/write)</div>
        <div className="text-xs text-slate-600 dark:text-slate-300">
          {errors.length ? <span className="text-red-400">{errors.length} error(s)</span> : <span className="text-emerald-400">valid</span>}
        </div>
      </div>

      <div className="min-h-0 rounded overflow-hidden border border-white/10">
        <MonacoEditor
          theme="vs-dark"
          language="yaml"
          value={local}
          onChange={(v) => setLocal(v ?? "")}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            automaticLayout: true,
            wordWrap: "on",
            tabSize: 2,
            insertSpaces: false,
            renderWhitespace: "selection",
          }}
        />
      </div>

      <div className="h-10 mt-2 flex items-center justify-between">
        <div className="text-xs text-red-400">
          {errors.length > 0 && (
            <ul className="list-disc ml-5">
              {errors.slice(0, 3).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {errors.length > 3 ? <li>…and more</li> : null}
            </ul>
          )}
        </div>
        <button
          className="text-xs px-3 py-1.5 rounded-md border border-emerald-400/30 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white"
          onClick={() => onChange(local)}
        >Apply</button>
      </div>
    </div>
  );
}


