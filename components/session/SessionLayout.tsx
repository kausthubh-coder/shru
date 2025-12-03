"use client";

import { ReactNode } from "react";
import { SpaceDefinition } from "@/types/space";
import { useRouter } from "next/navigation";

interface SessionLayoutProps {
    children: ReactNode;
    sessionName: string;
    activeSpaceId: string;
    spaces: SpaceDefinition[];
    onSpaceChange: (spaceId: string) => void;
    onToggleHistory?: () => void;
}

export function SessionLayout({
    children,
    sessionName,
    activeSpaceId,
    spaces,
    onSpaceChange,
    onToggleHistory,
}: SessionLayoutProps) {
    const router = useRouter();

    return (
        <div className="flex h-screen flex-col bg-gray-50">
            {/* Top Navigation Bar */}
            <header className="flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ← Back
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900">{sessionName}</h1>
                </div>

                <div className="flex items-center gap-2">
                    {/* Future: Agent Status / Controls */}
                    <div className="text-sm text-gray-500">AI Agent Ready</div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar / Tabs */}
                <aside className="w-64 border-r bg-white flex flex-col">
                    <div className="p-4 font-medium text-gray-500 text-sm uppercase tracking-wider">
                        Spaces
                    </div>
                    <nav className="flex-1 space-y-1 px-2">
                        {spaces.map((space) => (
                            <button
                                key={space.id}
                                onClick={() => onSpaceChange(space.id)}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSpaceId === space.id
                                        ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                            >
                                {space.name}
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 border-t">
                        <button
                            onClick={onToggleHistory}
                            className="w-full text-left text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
                        >
                            <span>🕒</span> History
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-hidden relative">
                    {children}
                </main>
            </div>
        </div>
    );
}
