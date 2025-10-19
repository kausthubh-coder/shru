"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePageNav } from "./pageNavContext";

type GridBackgroundProps = {
  intensity?: number; // parallax pixels at most
  className?: string;
};

export default function GridBackground({ intensity = 10, className }: GridBackgroundProps) {
  const { scrollTop } = usePageNav();
  const reduced = useReducedMotion();
  const translateY = useMemo(() => {
    const prefersReduced = reduced || (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (prefersReduced) return 0;
    const offset = scrollTop * 0.05; // subtle parallax
    const max = Math.max(0, Math.min(intensity, offset));
    return Math.floor(max);
  }, [scrollTop, intensity, reduced]);

  return (
    <motion.div
      aria-hidden
      className={
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-none " + (className || "")
      }
      style={{
        backgroundColor: "#F6F1E8",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 32px)," +
          "repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 32px)",
        transform: `translateY(${translateY}px)`,
        transition: "transform 250ms ease-out",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    />
  );
}


