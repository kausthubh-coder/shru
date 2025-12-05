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

  const isFormValid = !isCreating && newSessionName.trim().length > 0 && selectedSpaces.length > 0;

  return (
    <div className="max-w-5xl mx-auto w-full relative">
      {/* Graph Paper Grid Background - Scoped to Dashboard Area */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-10" 
          style={{
            backgroundImage: `linear-gradient(#000000 1px, transparent 1px), linear-gradient(90deg, #000000 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Create New Session Card */}
        <div className="bg-[#F2F1EA] p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-2xl font-serif mb-6 text-black font-bold">New Session</h2>
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
                className="w-full px-4 py-3 bg-white border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-all"
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
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer border-2 transition-all duration-200 ${
                      selectedSpaces.includes(space.id)
                        ? "bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "border-transparent hover:bg-black/5 hover:border-black/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSpaces.includes(space.id)}
                      onChange={() => toggleSpace(space.id)}
                      className="h-5 w-5 rounded border-2 border-gray-400 text-black focus:ring-black/20"
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
              disabled={!isFormValid}
              className={`w-full py-3 px-4 border-2 border-black rounded-lg font-medium transition-all duration-300 flex justify-center items-center ${
                isFormValid 
                  ? "bg-black text-white hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg" 
                  : "bg-[#D6D1C4] text-gray-500 cursor-not-allowed border-black/20"
              }`}
            >
              {isCreating ? "Creating..." : "Create Session"}
            </button>
          </form>
        </div>

        {/* Session List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-serif text-black font-bold">Recent Sessions</h2>
          {sessions === undefined ? (
            <div className="text-gray-500 animate-pulse">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-gray-500 italic bg-[#F2F1EA] p-8 rounded-xl border-2 border-black border-dashed text-center">
              No sessions yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session._id}
                  onClick={() => router.push(`/session/${session._id}`)}
                  className="group bg-[#F2F1EA] p-5 rounded-xl border-2 border-black hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-xl text-gray-900 font-serif">
                      {session.title}
                    </div>
                    <div className="text-xs bg-white px-2 py-1 rounded border border-black text-gray-500 font-mono">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {session.spaceTypes?.map((type: string) => (
                      <span
                        key={type}
                        className="text-xs px-2 py-1 bg-white rounded text-black border border-black font-medium"
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
