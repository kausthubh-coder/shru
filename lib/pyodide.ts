"use client";

type PyodideInstance = {
    setStdout: (opts: { batched: (s: string) => void }) => void;
    setStderr: (opts: { batched: (s: string) => void }) => void;
    runPythonAsync: (code: string) => Promise<unknown>;
};

declare global {
    interface Window {
        loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInstance>;
    }
}

let pyodideInstancePromise: Promise<PyodideInstance> | null = null;

export async function loadPyodideOnce() {
    if (!pyodideInstancePromise) {
        pyodideInstancePromise = new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js";
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
        }).then(() => {
            if (!window.loadPyodide) throw new Error("Pyodide loader not found");
            return window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/",
            });
        });
    }
    return pyodideInstancePromise;
}
