"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SpaceProps } from "@/types/space";
import { NotesEditor } from "@/components/lesson/NotesEditor";
import { NotesRenderer } from "@/components/lesson/NotesRenderer";

type LessonContent = { yaml: string };

const DEFAULT_LESSON_YAML = [
  "title: Lesson",
  "version: 1",
  "blocks:",
  "  - type: text",
  "    md: |\n      ## Welcome\n      Replace this YAML with your lesson content.",
].join("\n");

export default function LessonSpace({
  initialContent,
  onContentChange,
  readOnly,
}: SpaceProps<LessonContent>) {
  const initialYaml = useMemo(() => {
    if (typeof initialContent === "string") return initialContent;
    if (initialContent?.yaml) return initialContent.yaml;
    return DEFAULT_LESSON_YAML;
  }, [initialContent]);

  const [yaml, setYaml] = useState(initialYaml);

  useEffect(() => {
    if (initialYaml !== yaml) {
      setYaml(initialYaml);
    }
  }, [initialYaml, yaml]);

  const handleApply = useCallback(
    (nextYaml: string) => {
      if (readOnly) return;
      setYaml(nextYaml);
      onContentChange({ yaml: nextYaml });
    },
    [onContentChange, readOnly],
  );

  return (
    <div className="w-full h-full grid gap-4 md:grid-cols-2 p-4">
      <div className="min-h-0">
        <NotesEditor value={yaml} onChange={handleApply} readOnly={!!readOnly} />
      </div>
      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <NotesRenderer yaml={yaml} />
      </div>
    </div>
  );
}

