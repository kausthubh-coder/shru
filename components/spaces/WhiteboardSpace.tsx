"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, Editor, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { SpaceProps } from "@/types/space";

// We'll need to expose the editor instance for the Agent later.
// For now, we'll store it in a window global or similar for the prototype,
// or we can add a callback to props if we want to be cleaner.
// Let's add an optional `onMount` to SpaceProps in the future if needed.

export default function WhiteboardSpace({
    initialContent,
    onContentChange,
    isActive,
    readOnly,
}: SpaceProps) {
    const [editor, setEditor] = useState<Editor | null>(null);
    const lastAppliedSnapshotHash = useRef<string | null>(null);
    const pendingSnapshotRef = useRef<any>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const applySnapshot = useCallback((snapshot: any) => {
        if (!editor || !snapshot) return;
        try {
            loadSnapshot(editor.store, snapshot);
            lastAppliedSnapshotHash.current = snapshotHash(snapshot);
        } catch (err) {
            console.error("Failed to load whiteboard snapshot", err);
        }
    }, [editor]);

    const handleMount = useCallback((nextEditor: Editor) => {
        setEditor(nextEditor);
    }, []);

    useEffect(() => {
        if (!editor || !initialContent) return;
        const incomingHash = snapshotHash(initialContent);
        if (!incomingHash) return;
        if (lastAppliedSnapshotHash.current === incomingHash) return;
        applySnapshot(initialContent);
    }, [editor, initialContent, applySnapshot]);

    const flushPendingSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        if (!pendingSnapshotRef.current) return;
        onContentChange(pendingSnapshotRef.current);
        lastAppliedSnapshotHash.current = snapshotHash(pendingSnapshotRef.current);
        pendingSnapshotRef.current = null;
    }, [onContentChange]);

    const scheduleSave = useCallback(() => {
        if (!editor || readOnly) return;
        pendingSnapshotRef.current = getSnapshot(editor.store);
        if (saveTimeoutRef.current) {
            return;
            }
        saveTimeoutRef.current = setTimeout(() => {
            flushPendingSave();
        }, 500);
    }, [editor, readOnly, flushPendingSave]);

    useEffect(() => {
        if (!editor) return;
        const unsubscribe = editor.store.listen(
            () => {
                scheduleSave();
            },
            { scope: 'document', source: 'user' }
        );
        return () => {
            unsubscribe();
            flushPendingSave();
        };
    }, [editor, scheduleSave, flushPendingSave]);

    return (
        <div className="w-full h-full relative">
            <Tldraw
                onMount={handleMount}
                options={{ maxPages: 1 } as any}
            />
        </div>
    );
}

function snapshotHash(snapshot: any) {
    try {
        return JSON.stringify(snapshot);
    } catch {
        return null;
    }
}
