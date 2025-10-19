"use client";

import React, { useEffect, useRef } from "react";

export default function LaserPointer({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0;
    const resize = () => {
      // Measure actual CSS box; transformed ancestors can change the fixed element's containing block
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    };
    resize();
    const onResize = () => { resize(); };
    window.addEventListener('resize', onResize);
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => onResize());
      ro.observe(canvas);
    } catch {}

    const points: Array<{ x: number; y: number; t: number }> = [];
    const maxPoints = 24;
    const onMove = (e: MouseEvent) => {
      if (!enabled) return;
      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      points.push({ x: localX, y: localY, t: Date.now() });
      if (points.length > maxPoints) points.shift();
    };
    window.addEventListener('mousemove', onMove);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      // Reset and clear at device pixels, then set transform to CSS pixels for drawing
      try { ctx.setTransform(1,0,0,1,0,0); } catch {}
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      try { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); } catch {}
      if (!enabled) return;
      // Spotlight
      const p = points[points.length - 1];
      if (p) {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 80);
        grad.addColorStop(0, 'rgba(255,0,0,0.25)');
        grad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(p.x, p.y, 80, 0, Math.PI * 2); ctx.fill();
      }
      // Trail
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const age = (Date.now() - b.t) / 800;
        const alpha = Math.max(0, 1 - age);
        if (alpha <= 0) continue;
        ctx.strokeStyle = `rgba(255,0,0,${alpha * 0.6})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
      try { ro?.disconnect(); } catch {}
    };
  }, [enabled]);

  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return null;
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[55]" />;
}


