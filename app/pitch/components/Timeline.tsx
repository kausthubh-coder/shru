"use client";

import React from "react";

type TimelineItem = { title: string; items: Array<string>; color?: "green" | "blue" };

type TimelineProps = {
  left: TimelineItem;
  right: Array<TimelineItem>;
};

export default function Timeline({ left, right }: TimelineProps) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-3 text-xl font-semibold">{left.title}</h3>
        <ul className="space-y-2">
          {left.items.map((t, i) => (
            <li key={i} className="rounded-lg border border-black/15 bg-white p-3 shadow-sm">
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        {right.map((g, gi) => (
          <div key={gi} className="rounded-xl border border-black/15 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={
                  "inline-block h-2 w-2 rounded-full " +
                  (g.color === "green" ? "bg-green-600" : g.color === "blue" ? "bg-blue-600" : "bg-black")
                }
                aria-hidden
              />
              <h4 className="text-lg font-semibold">{g.title}</h4>
            </div>
            <ul className="list-disc space-y-1 pl-6 text-black/80">
              {g.items.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}


