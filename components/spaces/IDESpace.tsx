"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { SpaceProps } from "@/types/space";
import { loadPyodideOnce } from "@/lib/pyodide";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
});

interface IdeContent {
    files: Array<{ name: string; language: string; content: string }>;
    activeFile?: string;
}

const DEFAULT_FILES: IdeContent["files"] = [
    {
        name: "main.py",
        language: "python",
        content: "# Welcome to the workspace\nprint('Hello from the IDE tab')\n",
    },
];

export default function IDESpace({
    initialContent,
    onContentChange,
    readOnly,
}: SpaceProps<IdeContent>) {
    const initialFiles = initialContent?.files?.length ? initialContent.files : DEFAULT_FILES;
    const initialActiveFile =
        initialContent?.activeFile ||
        initialFiles[0]?.name ||
        DEFAULT_FILES[0].name;

    const [files, setFiles] = useState<IdeContent["files"]>(initialFiles);
    const [activeFileName, setActiveFileName] = useState<string>(initialActiveFile);
    const [output, setOutput] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const activeFile = files.find((f) => f.name === activeFileName) ?? files[0];

    useEffect(() => {
        if (!initialContent) return;
        const nextFiles = initialContent.files?.length ? initialContent.files : DEFAULT_FILES;
        setFiles(nextFiles);
        setActiveFileName(initialContent.activeFile || nextFiles[0]?.name || DEFAULT_FILES[0].name);
    }, [initialContent]);

    const handleEditorChange = (value: string | undefined) => {
        if (readOnly || typeof value !== "string" || !activeFile) return;
        const newFiles = files.map((f) =>
            f.name === activeFile.name ? { ...f, content: value } : f
        );
        setFiles(newFiles);
        onContentChange({ files: newFiles, activeFile: activeFile.name });
    };

    const handleSelectFile = useCallback((fileName: string) => {
        setActiveFileName(fileName);
        onContentChange({ files, activeFile: fileName });
    }, [files, onContentChange]);

    const runCode = async () => {
        if (!activeFile || activeFile.language !== "python") return;
        setIsRunning(true);
        setOutput([]);
        try {
            const pyodide = await loadPyodideOnce();
            pyodide.setStdout({ batched: (s: string) => setOutput((prev) => [...prev, s]) });
            pyodide.setStderr({ batched: (s: string) => setOutput((prev) => [...prev, `Error: ${s}`]) });
            await pyodide.runPythonAsync(activeFile.content);
        } catch (err: unknown) {
            setOutput((prev) => [...prev, `Runtime Error: ${err instanceof Error ? err.message : String(err)}`]);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2">
                <div className="flex gap-2">
                    {files.map((file) => (
                        <button
                            key={file.name}
                            onClick={() => handleSelectFile(file.name)}
                            className={`px-3 py-1 text-sm rounded ${activeFileName === file.name
                                    ? "bg-white shadow text-blue-600 font-medium"
                                    : "text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            {file.name}
                        </button>
                    ))}
                </div>
                <button
                    onClick={runCode}
                    disabled={isRunning || activeFile?.language !== "python"}
                    className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                    {isRunning ? "Running..." : "Run"}
                </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row">
                <div className="flex-1 border-r">
                    <MonacoEditor
                        height="100%"
                        language={activeFile?.language || "python"}
                        value={activeFile?.content || ""}
                        onChange={handleEditorChange}
                        options={{ readOnly, minimap: { enabled: false } }}
                    />
                </div>
                <div className="h-48 md:h-auto md:w-1/3 bg-gray-900 text-gray-100 p-4 overflow-auto font-mono text-sm">
                    <div className="font-bold text-gray-400 mb-2">Output</div>
                    {output.length === 0 ? (
                        <div className="text-gray-600 italic">No output</div>
                    ) : (
                        output.map((line, i) => <div key={i}>{line}</div>)
                    )}
                </div>
            </div>
        </div>
    );
}
