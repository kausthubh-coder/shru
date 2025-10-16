"use client";

import React, { useEffect, useRef } from "react";

type NodeInfo = { id: string; label: string; fact: string };

const nodes: Array<NodeInfo> = [
  { id: "voice", label: "Voice Agent", fact: "Realtime voice orchestrates the flow." },
  { id: "board", label: "Whiteboard", fact: "tldraw canvas with scripted strokes." },
  { id: "ide", label: "IDE", fact: "Monaco + Pyodide for safe runs." },
  { id: "notes", label: "Notes", fact: "YAML → rendered widgets." },
  { id: "convex", label: "Convex", fact: "Session gating + telemetry." },
];

export default function ArchitectureDiagram() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lines = Array.from(svg.querySelectorAll("line"));
    if (prefersReduced) return;
    for (const line of lines) {
      const length = Math.hypot(
        Number(line.getAttribute("x2")) - Number(line.getAttribute("x1")),
        Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"))
      );
      line.style.strokeDasharray = `${length}`;
      line.style.strokeDashoffset = `${length}`;
      requestAnimationFrame(() => {
        line.style.transition = "stroke-dashoffset 700ms ease-out";
        line.style.strokeDashoffset = "0";
      });
    }
  }, []);

  return (
    <div className="w-full">
      <svg ref={svgRef} viewBox="0 0 600 320" className="mx-auto w-full max-w-3xl" aria-label="Architecture diagram">
        {/* Top node */}
        <rect x="250" y="20" width="100" height="40" rx="10" className="fill-white stroke-black" />
        <text x="300" y="45" textAnchor="middle" className="fill-black text-[12px]">{nodes[0].label}</text>

        {/* Four nodes below */}
        <rect x="60" y="180" width="120" height="40" rx="10" className="fill-white stroke-black" />
        <text x="120" y="205" textAnchor="middle" className="fill-black text-[12px]">{nodes[1].label}</text>

        <rect x="220" y="180" width="120" height="40" rx="10" className="fill-white stroke-black" />
        <text x="280" y="205" textAnchor="middle" className="fill-black text-[12px]">{nodes[2].label}</text>

        <rect x="380" y="180" width="120" height="40" rx="10" className="fill-white stroke-black" />
        <text x="440" y="205" textAnchor="middle" className="fill-black text-[12px]">{nodes[3].label}</text>

        <rect x="220" y="260" width="120" height="40" rx="10" className="fill-white stroke-black" />
        <text x="280" y="285" textAnchor="middle" className="fill-black text-[12px]">{nodes[4].label}</text>

        {/* lines */}
        <line x1="300" y1="60" x2="120" y2="180" className="stroke-black" />
        <line x1="300" y1="60" x2="280" y2="180" className="stroke-black" />
        <line x1="300" y1="60" x2="440" y2="180" className="stroke-black" />
        <line x1="280" y1="220" x2="280" y2="260" className="stroke-black" />
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        {nodes.map((n) => (
          <div key={n.id} className="rounded-lg border border-black/20 bg-white p-3 shadow-sm transition hover:shadow">
            <div className="font-medium">{n.label}</div>
            <div className="text-black/70">{n.fact}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


