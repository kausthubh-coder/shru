"use client";

import React from "react";

type ChipProps = {
  children: React.ReactNode;
  icon?: React.ReactNode;
  color?: "default" | "green" | "blue";
  className?: string;
};

export default function Chip({ children, icon, color = "default", className }: ChipProps) {
  const theme =
    color === "green"
      ? "bg-green-100 text-green-900 border-green-300"
      : color === "blue"
      ? "bg-blue-100 text-blue-900 border-blue-300"
      : "bg-black/5 text-black border-black/20";
  return (
    <span className={"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm " + theme + " " + (className || "")}>{icon}{children}</span>
  );
}


