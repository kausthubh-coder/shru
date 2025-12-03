"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AVAILABLE_SPACES } from "@/components/spaces/SpaceRegistry";
import { SpaceKind } from "@/types/space";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const sessions = useQuery(api.sessions.list);
  const createSession = useMutation(api.sessions.create);
  const router = useRouter();

  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [selectedSpaces, setSelectedSpaces] = useState<SpaceKind[]>([
    "whiteboard",
    "lesson",
  ]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setIsCreating(true);
    try {
      const sessionId = await createSession({
        name: newSessionName,
        initialSpaces: selectedSpaces,
      });
      router.push(`/session/${sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      setIsCreating(false);
    }
  };

  const toggleSpace = (spaceId: SpaceKind) => {
    setSelectedSpaces((prev) =>
      prev.includes(spaceId)
        ? prev.filter((id) => id !== spaceId)
        : [...prev, spaceId],
    );
  };

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Create New Session Card */}
        <div className="bg-[#F2F1EA] p-6 rounded-xl border border-black/5 shadow-sm">
          <h2 className="text-2xl font-serif mb-6">New Session</h2>
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Name
              </label>
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="e.g., Physics Study Group"
                className="w-full px-4 py-3 bg-white border border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Include Spaces
              </label>
              <div className="space-y-3">
                {AVAILABLE_SPACES.map((space) => (
                  <label
                    key={space.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer border transition-all ${
                      selectedSpaces.includes(space.id)
                        ? "bg-white border-black/20 shadow-sm"
                        : "border-transparent hover:bg-black/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSpaces.includes(space.id)}
                      onChange={() => toggleSpace(space.id)}
                      className="h-5 w-5 rounded border-gray-300 text-black focus:ring-black/20"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        {space.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {space.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isCreating || !newSessionName.trim() || selectedSpaces.length === 0
              }
              className="w-full py-3 px-4 bg-[#1A1A1A] text-[#F2F1EA] rounded-lg font-medium hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {isCreating ? "Creating..." : "Create Session"}
            </button>
          </form>
        </div>

        {/* Session List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-serif">Recent Sessions</h2>
          {sessions === undefined ? (
            <div className="text-gray-500 animate-pulse">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-gray-500 italic bg-[#F2F1EA] p-8 rounded-xl border border-black/5 text-center">
              No sessions yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session._id}
                  onClick={() => router.push(`/session/${session._id}`)}
                  className="group bg-[#F2F1EA] p-5 rounded-xl border border-black/5 hover:border-black/20 cursor-pointer transition-all hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-xl text-gray-900 font-serif">
                      {session.title}
                    </div>
                    <div className="text-xs bg-white px-2 py-1 rounded border border-black/5 text-gray-500">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {session.spaceTypes?.map((type: string) => (
                      <span
                        key={type}
                        className="text-xs px-2 py-1 bg-white/50 rounded text-gray-600 border border-black/5"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


