"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { parseNotesYaml, NotesDocT, BlockT } from "../types/notesYaml";

export function NotesRenderer({ yaml }: { yaml: string }) {
  const { doc, errors } = useMemo(() => parseNotesYaml(yaml), [yaml]);

  if (errors.length > 0) {
    return (
      <div className="text-sm">
        <div className="text-red-600 font-medium mb-1">YAML errors</div>
        <ul className="list-disc ml-5 space-y-1">
          {errors.map((e, i) => (
            <li key={i} className="text-red-500">{e}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-8 space-y-8 md:space-y-10">
      <div className="pt-1">
        <h1 className="text-2xl md:text-3xl font-semibold text-center bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
          {doc.title}
        </h1>
      </div>
      {doc.blocks.map((b, i) => (
        <BlockView key={(b as any).id ?? i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: BlockT }) {
  switch (block.type) {
    case "text":
      return (
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
            {block.md}
          </ReactMarkdown>
        </div>
      );
    case "quiz":
      return <QuizBlockView id={block.id} title={block.title} questions={block.questions} />;
    case "input":
      return <InputBlockView id={block.id} label={block.label} inputType={block.inputType} placeholder={block.placeholder} />;
    case "embed":
      return <EmbedBlockView id={block.id} provider={block.provider} refId={block.ref} height={block.height} />;
    default:
      return null as any;
  }
}

function QuizBlockView({ id, title, questions }: { id: string; title?: string; questions: Array<{ id: string; prompt: string; options: Array<string>; answer: string; explanation?: string }>; }) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const correctCount = useMemo(() => {
    let c = 0; for (const q of questions) { if (answers[q.id] === q.answer) c++; } return c;
  }, [answers, questions]);
  return (
    <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4 md:p-5 w-full md:max-w-xl mx-auto">
      <div className="text-sm font-semibold mb-2 text-slate-50">{title ?? "Quiz"}</div>
      <ol className="space-y-3 list-decimal ml-4">
        {questions.map((q) => (
          <li key={q.id} className="space-y-1">
            <div className="text-sm text-slate-100">{q.prompt}</div>
            <div className="grid gap-1">
              {q.options.map((opt) => (
                <label key={opt} className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input type="radio" name={`${id}-${q.id}`} checked={answers[q.id] === opt} onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))} />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            {submitted && (
              <div className={answers[q.id] === q.answer ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>
                {answers[q.id] === q.answer ? "Correct" : `Incorrect. Answer: ${q.answer}`}
                {q.explanation ? <span className="ml-2 text-slate-300">{q.explanation}</span> : null}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-2">
        <button className="text-xs px-2 py-1 rounded border border-emerald-400/30 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white" onClick={() => setSubmitted(true)}>Check</button>
        {submitted && <div className="text-xs text-slate-300">Score: {correctCount}/{questions.length}</div>}
      </div>
    </div>
  );
}

function InputBlockView({ id, label, inputType, placeholder }: { id: string; label: string; inputType: "text" | "number"; placeholder?: string }) {
  const [val, setVal] = React.useState("");
  return (
    <div className="flex items-center gap-2 w-full md:max-w-xl mx-auto">
      <label htmlFor={id} className="text-sm min-w-[8rem] text-slate-200">{label}</label>
      <input
        id={id}
        type={inputType === "number" ? "number" : "text"}
        placeholder={placeholder}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="text-sm px-2 py-1 rounded border border-white/10 bg-slate-800 text-slate-100"
      />
    </div>
  );
}

function EmbedBlockView({ id, provider, refId, height }: { id: string; provider: "codepen" | "stackblitz" | "jsfiddle"; refId: string; height: number }) {
  const src = useMemo(() => {
    if (provider === "codepen") return `https://codepen.io/${"pen"}/embed/${refId}?default-tab=result`;
    if (provider === "stackblitz") return `https://stackblitz.com/edit/${refId}?embed=1&file=index.tsx`;
    if (provider === "jsfiddle") return `https://jsfiddle.net/${refId}/embedded/result/`;
    return "about:blank";
  }, [provider, refId]);
  return (
    <div className="rounded-lg overflow-hidden border border-white/10">
      <iframe
        title={`${provider}-${id}`}
        src={src}
        loading="lazy"
        style={{ width: "100%", height: `${height}px`, border: 0 }}
        sandbox="allow-scripts allow-forms allow-pointer-lock allow-popups allow-top-navigation-by-user-activation"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}


