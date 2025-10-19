"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type NumberStatProps = {
  value: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
};

export default function NumberStat({ value, suffix = "", durationMs = 800, className }: NumberStatProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [display, setDisplay] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        if (prefersReduced) {
          setDisplay(value);
          setHasAnimated(true);
          return;
        }
        if (hasAnimated) return;
        const start = performance.now();
        const animate = (t: number) => {
          const p = Math.min(1, (t - start) / durationMs);
          setDisplay(Math.round(value * p));
          if (p < 1) requestAnimationFrame(animate);
          else setHasAnimated(true);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.6 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, durationMs, hasAnimated]);

  return (
    <motion.div ref={ref} className={className} aria-label={`${value}${suffix}`} initial={{ scale: 0.95, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 220 }}>
      {display.toLocaleString()}<span aria-hidden>{suffix}</span>
    </motion.div>
  );
}


