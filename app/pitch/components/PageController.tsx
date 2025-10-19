"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageNavContext } from "./pageNavContext";

export type SectionSpec = {
  id: string;
  label: string;
  render: () => React.ReactNode;
};

type PageControllerProps = {
  sections: Array<SectionSpec>;
};

export default function PageController({ sections }: PageControllerProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [mode, setMode] = useState<"scroll" | "presentation">("presentation");
  const [revealStep, setRevealStep] = useState(0);

  // Keep refs array stable; indices are assigned via ref callbacks.

  const scrollToIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, sections.length - 1));
    const el = sectionRefs.current[clamped];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [sections.length]);

  const goNext = useCallback(() => scrollToIndex(currentIndex + 1), [currentIndex, scrollToIndex]);
  const goPrev = useCallback(() => scrollToIndex(currentIndex - 1), [currentIndex, scrollToIndex]);

  // Keyboard navigation: Space / Arrows / digits 1..9 and 0; in presentation mode Space advances reveal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      // Skip when typing in inputs or editable areas
      if (activeTag === "input" || activeTag === "textarea" || (document.activeElement as HTMLElement | null)?.isContentEditable) {
        return;
      }
      if (mode === "presentation" && e.code === "Space") {
        e.preventDefault();
        setRevealStep((s) => s + 1);
        return;
      }
      if (e.code === "ArrowDown" || e.code === "PageDown") {
        e.preventDefault();
        goNext();
        setRevealStep(0);
      } else if (e.code === "ArrowUp" || e.code === "PageUp") {
        e.preventDefault();
        goPrev();
        setRevealStep(0);
      } else if (/^Digit[0-9]$/.test(e.code)) {
        const digit = Number(e.code.replace("Digit", ""));
        const index = digit === 0 ? 10 : digit; // 0 -> last section (index 10)
        if (!Number.isNaN(index)) {
          e.preventDefault();
          scrollToIndex(index);
          setRevealStep(0);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, scrollToIndex, mode]);

  // IntersectionObserver to track current section
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let visibleIndex = currentIndex;
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            visibleIndex = idx;
          }
        }
        if (visibleIndex !== currentIndex) {
          setCurrentIndex(visibleIndex);
        }
      },
      {
        root: container,
        threshold: [0.25, 0.5, 0.75, 0.9],
      }
    );

    // Observe all section elements once refs are set
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => {
      observer.disconnect();
    };
  }, [sections.length]);

  // Track scrollTop for parallax consumers
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => setScrollTop(container.scrollTop);
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  const progress = useMemo(() => (sections.length <= 1 ? 0 : currentIndex / (sections.length - 1)), [currentIndex, sections.length]);

  const contextValue = useMemo(() => ({
    currentIndex,
    goNext,
    goPrev,
    scrollToIndex,
    scrollTop,
    mode,
    revealStep,
    setRevealStep: (n: number) => setRevealStep(n),
  }), [currentIndex, goNext, goPrev, scrollToIndex, scrollTop, mode, revealStep]);

  return (
    <PageNavContext.Provider value={contextValue}>
    <div className="relative h-screen w-full">
      {/* Progress bar (gradient) and presenter toggle */}
      <div aria-hidden className="fixed left-0 top-0 z-40 h-1 w-full bg-black/10" />
      <div
        className="fixed left-0 top-0 z-50 h-1 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(0.02, progress) * 100}%` }}
        aria-hidden
      />
      <div className="fixed left-4 top-3 z-50">
        <button
          onClick={() => setMode((m) => (m === "scroll" ? "presentation" : "scroll"))}
          className="rounded-full border border-black/20 bg-white/80 px-3 py-1 text-xs text-black shadow hover:bg-white"
          aria-pressed={mode === "presentation"}
        >{mode === "presentation" ? "Presentation" : "Scroll"}</button>
      </div>

      {/* Right-side dot nav with simple tooltips */}
      <nav aria-label="Section navigation" className="pointer-events-auto fixed right-4 top-1/2 z-50 -translate-y-1/2">
        <ul className="flex flex-col gap-3">
          {sections.map((s, i) => (
            <li key={s.id}>
              <button
                aria-label={`Go to ${s.label}`}
                aria-current={i === currentIndex}
                onClick={() => scrollToIndex(i)}
                className={
                  "relative h-3 w-3 rounded-full border border-black/60 transition " +
                  (i === currentIndex ? "bg-black scale-110" : "bg-transparent hover:bg-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black")
                }
              />
              <div className="pointer-events-none absolute -left-2 -translate-x-full -translate-y-1/2 bg-white text-black text-[10px] rounded px-2 py-0.5 border border-black/10 shadow opacity-0 group-hover:opacity-100">
                {s.label}
              </div>
            </li>
          ))}
        </ul>
      </nav>

      {/* Next button / Presenter hint */}
      <div className="pointer-events-auto fixed bottom-4 right-4 z-50">
        <button
          onClick={goNext}
          className="rounded-full bg-black px-5 py-2 text-white shadow transition-colors hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          aria-label="Next section"
        >
          {mode === "presentation" ? "Next (→)" : "Next"}
        </button>
      </div>

      {/* Scroll container */}
      <div ref={scrollContainerRef} className="h-full snap-y snap-mandatory overflow-y-scroll scroll-smooth text-black">
        {sections.map((s, i) => (
            <section
            key={s.id}
            id={s.id}
            data-index={i}
              ref={(el) => { sectionRefs.current[i] = el; }}
            className="relative min-h-screen snap-start"
          >
            {/* Parallax data via CSS variable consumers */}
            <div data-scrolltop={scrollTop} className="h-full w-full">
              {s.render()}
            </div>
          </section>
        ))}
      </div>
    </div>
    </PageNavContext.Provider>
  );
}


