"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

type RevealProps = {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
  fromY?: number; // px
  fromScale?: number; // e.g. 0.96
  step?: number; // current reveal step
  need?: number; // required step to show
};

export default function Reveal({ children, delayMs = 0, className, fromY = 16, fromScale = 1, step, need }: RevealProps) {
  const reduced = useReducedMotion();
  const shouldShow = typeof step === "number" && typeof need === "number" ? step >= need : true;
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: fromY, scale: fromScale }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      animate={shouldShow ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: fromY, scale: fromScale }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ delay: delayMs / 1000, duration: 0.5, type: "spring", stiffness: 220 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}


