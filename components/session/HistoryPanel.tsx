"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface HistoryPanelProps {
    spaceId: Id<"spaces">;
    onClose: () => void;
    onRestore: (content: any) => void;
}

export function HistoryPanel({ spaceId, onClose, onRestore }: HistoryPanelProps) {
    const versions = useQuery(api.spaces.listVersions, { spaceId });
    const saveVersion = useMutation(api.spaces.saveVersion);

    const handleSaveNow = async () => {
        await saveVersion({ spaceId });
    };

    return (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-xl border-l z-50 flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-semibold text-gray-900">History</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                    ✕
                </button>
            </div>

            <div className="p-4 border-b">
                <button
                    onClick={handleSaveNow}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                    Save Current Version
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
                {versions === undefined ? (
                    <div className="text-gray-500 text-sm">Loading history...</div>
                ) : versions.length === 0 ? (
                    <div className="text-gray-500 text-sm italic">No saved versions yet.</div>
                ) : (
                    versions.map((v) => (
                        <div
                            key={v._id}
                            className="border rounded p-3 hover:bg-gray-50 transition-colors"
                        >
                            <div className="text-sm font-medium text-gray-900">
                                {new Date(v.createdAt).toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                by {v.createdBy}
                            </div>
                            <button
                                onClick={() => onRestore(v.content)}
                                className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Restore this version
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
