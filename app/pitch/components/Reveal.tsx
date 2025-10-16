"use client";

import React, { useEffect, useRef, useState } from "react";

type RevealProps = {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
  fromY?: number; // px
  fromScale?: number; // e.g. 0.96
};

export default function Reveal({ children, delayMs = 0, className, fromY = 16, fromScale = 1 }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        if (prefersReduced) {
          setVisible(true);
          return;
        }
        const t = setTimeout(() => setVisible(true), delayMs);
        return () => clearTimeout(t);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delayMs]);

  const style = visible
    ? { opacity: 1, transform: "translateY(0) scale(1)" }
    : {
        opacity: 0,
        transform: `translateY(${fromY}px) scale(${fromScale})`,
      };

  return (
    <div
      ref={ref}
      style={style}
      className={(className || "") + " transition-all duration-300 ease-out motion-reduce:transform-none"}
    >
      {children}
    </div>
  );
}


