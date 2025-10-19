"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useTransform, useReducedMotion } from "framer-motion";

type TiltCardProps = {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // degrees
};

export default function TiltCard({ children, className, maxTilt = 8 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);
  const rx = useTransform(dy, [-80, 80], [maxTilt, -maxTilt]);
  const ry = useTransform(dx, [-80, 80], [-maxTilt, maxTilt]);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    dx.set(e.clientX - cx);
    dy.set(e.clientY - cy);
  };

  const onLeave = () => {
    dx.set(0); dy.set(0);
  };

  if (reduced) {
    return (
      <div ref={ref} className={className}>{children}</div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: rx as any, rotateY: ry as any, transformStyle: "preserve-3d" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-tr from-white/0 via-white/10 to-white/0" />
    </motion.div>
  );
}


