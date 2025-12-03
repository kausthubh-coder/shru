"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";
import SessionWorkspace from "@/components/session/SessionWorkspace";

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as Id<"sessions">;

  const session = useQuery(api.sessions.get, { id: sessionId });

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading session...</div>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Session not found or access denied.</div>
      </div>
    );
  }

  // Map convex spaceTypes to component enabledTools
  const enabledTools = (session.spaceTypes || []).map((t: string) => {
    if (t === "ide") return "code";
    if (t === "lesson") return "notes";
    return t;
  }) as ("whiteboard" | "code" | "notes")[];

  return (
    <div className="h-screen flex flex-col bg-[#e8e4d9] overflow-hidden">
      <header className="bg-[#F2F1EA]/50 border-b border-black/5 px-4 py-3 backdrop-blur-sm z-10 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs font-medium text-gray-600 hover:text-black transition-colors flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Dashboard
            </Link>
            <div className="h-4 w-px bg-gray-300" />
            <h1 className="text-lg font-serif font-medium">{session.title}</h1>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Session
          </div>
        </div>
      </header>
      <div className="flex-1 relative overflow-hidden">
        <SessionWorkspace enabledTools={enabledTools} />
      </div>
    </div>
  );
}

