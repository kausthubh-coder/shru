"use client";

import React from "react";

type SectionProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Section({ children, className }: SectionProps) {
  return (
    <div
      className={
        "relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-6 md:px-10 md:py-8 " +
        (className || "")
      }
    >
      <div className="w-full my-auto">
        {children}
      </div>
    </div>
  );
}


