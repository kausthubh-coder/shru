"use client";

import React, { useEffect } from "react";
import { motion, useMotionValue, animate, useReducedMotion } from "framer-motion";

export default function AnimatedCounter({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(mv, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [value, reduced, mv]);

  return (
    <motion.span className={className} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
      {Math.round(mv.get())}
      <span aria-hidden>{suffix}</span>
    </motion.span>
  );
}


