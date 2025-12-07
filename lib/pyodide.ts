"use client";

type PyodideInstance = {
    setStdout: (opts: { batched: (s: string) => void }) => void;
    setStderr: (opts: { batched: (s: string) => void }) => void;
    runPythonAsync: (code: string) => Promise<unknown>;
};

type PyodideLoader = (opts: { indexURL: string }) => Promise<unknown>;

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
            const loader = (window as Window & { loadPyodide?: PyodideLoader }).loadPyodide;
            if (!loader) throw new Error("Pyodide loader not found");
            return loader({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/",
            }) as Promise<PyodideInstance>;
        });
    }
    return pyodideInstancePromise;
}
