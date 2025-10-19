"use client";

import React, { useEffect } from "react";
import { usePageNav } from "./components/pageNavContext";
import PageController, { type SectionSpec } from "./components/PageController";
import Section from "./components/Section";
import GridBackground from "./components/GridBackground";
import NumberStat from "./components/NumberStat";
import TiltCard from "./components/TiltCard";
import AnimatedCounter from "./components/AnimatedCounter";
import PresenterHUD from "./components/PresenterHUD";
import LaserPointer from "./components/LaserPointer";
import ArchitectureDiagram from "./components/ArchitectureDiagram";
import Timeline from "./components/Timeline";
import CTA from "./components/CTA";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Reveal from "./components/Reveal";

// Helper: Paper plane icon
function PaperPlane() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-black/70" aria-hidden>
      <path d="M3 11L21 3L13 21L11 13L3 11Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// Pulse animation for stats
function PulseStat({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-[pulse_2s_ease-in-out_infinite] will-change-transform">
      {children}
    </div>
  );
}

function useConfettiOnce() {
  useEffect(() => {
    // noop placeholder; can integrate a tiny confetti later
  }, []);
}

function PreloadSection() {
  const router = useRouter();
  const { goNext } = usePageNav();
  useEffect(() => {
    router.prefetch("/test-app");
    const t = setTimeout(() => {
      goNext();
    }, 1500);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <Section>
      <GridBackground />
      <Reveal>
        <div className="flex flex-col items-center gap-4 text-center text-black">
          <div className="text-4xl font-bold">Studi</div>
          <div className="text-black/70">Loading demo assets…</div>
        </div>
      </Reveal>
    </Section>
  );
}

// 1. INTRO - Professional, impactful
function IntroSection() {
  return (
    <Section>
      <GridBackground />
      <div className="relative w-full max-w-5xl text-center text-black">
        <div className="absolute -right-6 -top-10 animate-[float_3s_ease-in-out_infinite] motion-reduce:animate-none will-change-transform" aria-hidden>
          <PaperPlane />
        </div>
        <Reveal>
          <h1 className="mb-6 text-6xl font-extrabold tracking-tight md:text-7xl [text-wrap:balance]">
            Studi
          </h1>
        </Reveal>
        <Reveal delayMs={100}>
          <p className="mb-8 text-3xl font-bold text-black/90 [text-wrap:pretty]">
            Where learning is interactive, immediate, and intimate.
          </p>
        </Reveal>
        <Reveal delayMs={200}>
          <p className="mx-auto mb-10 max-w-3xl text-xl text-black/70 leading-relaxed [text-wrap:pretty]">
            A realtime AI tutor that sees your work, talks with you, and teaches by doing—
            not watching. Compress time-to-skill and build proof that employers trust.
          </p>
        </Reveal>
        <Reveal delayMs={300}>
          <div className="inline-flex flex-wrap items-center justify-center gap-4 mb-8">
            <div className="rounded-full bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-3 border border-blue-200 shadow-sm">
              <span className="font-semibold text-blue-700">Interactive</span>
            </div>
            <div className="rounded-full bg-gradient-to-r from-purple-50 to-purple-100 px-6 py-3 border border-purple-200 shadow-sm">
              <span className="font-semibold text-purple-700">Immediate</span>
            </div>
            <div className="rounded-full bg-gradient-to-r from-green-50 to-green-100 px-6 py-3 border border-green-200 shadow-sm">
              <span className="font-semibold text-green-700">Intimate</span>
            </div>
          </div>
        </Reveal>
        {/* Keyboard hint */}
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-black/60">
          <kbd className="rounded border border-black/20 bg-white px-2 py-0.5 shadow-sm">Space</kbd>
          <span>or</span>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-black/20 bg-white px-1.5 py-0.5 shadow-sm">↑</kbd>
            <kbd className="rounded border border-black/20 bg-white px-1.5 py-0.5 shadow-sm">↓</kbd>
          </div>
          <span>to navigate</span>
        </div>
      </div>
    </Section>
  );
}

// 2. PROBLEM - Relatable pain with hard data
function ProblemSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-6xl text-black">
        <Reveal>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Education hasn't changed—not because it's good.</h2>
        </Reveal>
        <Reveal delayMs={100}>
          <p className="mb-6 text-lg text-black/80 max-w-3xl">
            Because it became a social norm. We're still teaching the same way we did 100 years ago, but the world moved on.
          </p>
        </Reveal>

        <div className="mb-6 grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          <Reveal delayMs={200}>
            <div className="group relative overflow-hidden rounded-2xl border border-black/15 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-100 to-transparent opacity-50 rounded-full blur-2xl" />
              <div className="relative">
                <div className="mb-4 text-sm uppercase tracking-wide text-red-600 font-semibold">Traditional Learning</div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>One-size-fits-all pacing for everyone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Memorize for tests, forget after</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Slow feedback loops (days/weeks)</span>
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>

          <Reveal delayMs={300}>
            <div className="group relative overflow-hidden rounded-2xl border border-black/15 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100 to-transparent opacity-50 rounded-full blur-2xl" />
              <div className="relative">
                <div className="mb-4 text-sm uppercase tracking-wide text-orange-600 font-semibold">Online Courses</div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 mt-1">✗</span>
                    <span>Passive consumption: watch & copy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 mt-1">✗</span>
                    <span>No personalization—made for everyone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 mt-1">✗</span>
                    <span>Can't ask questions when stuck</span>
                  </li>
          </ul>
              </div>
        </div>
        </Reveal>
      </div>

        {/* Data section */}
        <Reveal delayMs={400}>
          <div className="mb-4 text-center">
            <h3 className="text-xl font-semibold mb-4">The data tells the story:</h3>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Reveal delayMs={500}>
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-red-50 to-white p-4 shadow-lg border border-red-100 transition-all hover:scale-105">
              <PulseStat>
                <NumberStat value={40} suffix="%" className="text-3xl font-bold text-red-600" />
              </PulseStat>
              <div className="mt-1 text-xs text-black/70 font-medium">college dropout rate</div>
          </div>
          </Reveal>

          <Reveal delayMs={600}>
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-white p-4 shadow-lg border border-orange-100 transition-all hover:scale-105">
              <PulseStat>
                <NumberStat value={52} suffix="%" className="text-3xl font-bold text-orange-600" />
              </PulseStat>
              <div className="mt-1 text-xs text-black/70 font-medium">grads work outside major</div>
          </div>
          </Reveal>

          <Reveal delayMs={700}>
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-yellow-50 to-white p-4 shadow-lg border border-yellow-100 transition-all hover:scale-105">
              <PulseStat>
                <NumberStat value={168} suffix="%" className="text-3xl font-bold text-yellow-600" />
              </PulseStat>
              <div className="mt-1 text-xs text-black/70 font-medium">tuition increase (40 yrs)</div>
        </div>
          </Reveal>

          <Reveal delayMs={800}>
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-red-50 to-white p-4 shadow-lg border border-red-100 transition-all hover:scale-105">
              <PulseStat>
                <div className="text-3xl font-bold text-red-600">&lt;15%</div>
              </PulseStat>
              <div className="mt-1 text-xs text-black/70 font-medium">MOOC completion rate</div>
      </div>
          </Reveal>
        </div>

        <Reveal delayMs={900}>
          <div className="rounded-2xl border-2 border-black/20 bg-gradient-to-br from-black/5 to-white p-6 text-center shadow-xl">
            <p className="text-xl font-semibold text-black leading-relaxed">
              "We memorize to pass tests instead of building skills we can use. 
              <span className="block mt-2 text-black/70">That's why learning feels slow, boring, and forgettable."</span>
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}


// 3. SOLUTION - Clear explanation of what Studi is
function SolutionSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-5xl text-center text-black">
        <Reveal>
          <h2 className="mb-6 text-4xl font-bold md:text-5xl">Studi = Realtime AI tutor that teaches by doing.</h2>
        </Reveal>
        <Reveal delayMs={100}>
          <p className="mb-10 text-xl text-black/70 max-w-3xl mx-auto">
            Not a chatbot with a course bolted on. A coach that sees your work and guides you through it—
            on a whiteboard, in code, and in real-time.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-10">
          {[
            { 
              title: "Whiteboard", 
              icon: "🎨",
              desc: "Draws diagrams, explains concepts visually",
              gradient: "from-blue-50 to-cyan-50"
            },
            { 
              title: "IDE", 
              icon: "⚡",
              desc: "Runs code, finds bugs, instant feedback",
              gradient: "from-purple-50 to-pink-50"
            },
            { 
              title: "Lesson Page", 
              icon: "📝",
              desc: "Generates quizzes, summaries, interactive notes",
              gradient: "from-green-50 to-emerald-50"
            },
          ].map((item, i) => (
            <Reveal key={item.title} delayMs={200 + i * 100}>
              <TiltCard className="group relative overflow-hidden rounded-xl border border-black/15 bg-white p-6 shadow-lg will-change-transform transition-all hover:shadow-2xl">
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-30`} />
                <div className="relative">
                  <div className="text-5xl mb-4">{item.icon}</div>
                  <div className="text-xl font-bold mb-2">{item.title}</div>
                  <div className="text-sm text-black/70">{item.desc}</div>
                </div>
                {/* Animated shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </TiltCard>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={500}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="rounded-xl bg-gradient-to-br from-blue-50 to-white p-5 border border-blue-100 shadow-sm">
              <div className="text-sm font-semibold text-blue-600 mb-2">✓ Hyper-personalized</div>
              <div className="text-sm text-black/70">Adapts minute-by-minute to YOUR goals and gaps</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-purple-50 to-white p-5 border border-purple-100 shadow-sm">
              <div className="text-sm font-semibold text-purple-600 mb-2">✓ Interactive</div>
              <div className="text-sm text-black/70">You don't watch—you solve, build, and prove understanding</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-green-50 to-white p-5 border border-green-100 shadow-sm">
              <div className="text-sm font-semibold text-green-600 mb-2">✓ Voice-first</div>
              <div className="text-sm text-black/70">Talk naturally like you're with a real tutor</div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function DemoSection() {
  return (
    <Section>
      <GridBackground />
      <div className="flex flex-col items-center justify-center w-full max-w-4xl text-black text-center">
        <Reveal>
          <h2 className="mb-6 text-4xl font-bold md:text-5xl">See it in action</h2>
        </Reveal>
        <Reveal delayMs={100}>
          <p className="mb-8 text-xl text-black/70 max-w-2xl">
            Experience the realtime AI tutor live. See how Studi guides you through whiteboard diagrams, 
            runs code, and generates interactive lessons—all in real-time.
          </p>
        </Reveal>
        <Reveal delayMs={200}>
          <Link 
            prefetch 
            href="/test-app" 
            className="inline-flex items-center gap-3 rounded-full bg-black px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-black/90 hover:scale-105 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <span>Launch Live Demo</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </Reveal>
        <Reveal delayMs={300}>
          <div className="mt-8 text-sm text-black/60">
            Interactive demo • No signup required • Works in your browser
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// 5. WHY IT WORKS - Differentiation with data
function WhyItWorksSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-6xl text-black">
        <Reveal>
          <h2 className="mb-5 text-3xl font-bold text-center md:text-4xl">Why Studi works better</h2>
        </Reveal>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Reveal delayMs={100}>
            <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-lg">
              <h3 className="text-lg font-bold mb-3 text-blue-600">Active Learning</h3>
              <div className="mb-3">
                <AnimatedCounter value={50} suffix="%" className="text-4xl font-bold text-blue-600" />
                <div className="text-xs text-black/70 mt-1">higher retention vs passive lectures</div>
              </div>
              <p className="text-sm text-black/80">
                Learning by doing beats watching videos—you remember more and master faster.
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={200}>
            <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 shadow-lg">
              <h3 className="text-lg font-bold mb-3 text-purple-600">Immediate Feedback</h3>
              <div className="mb-3">
                <AnimatedCounter value={30} suffix="%" className="text-4xl font-bold text-purple-600" />
                <div className="text-xs text-black/70 mt-1">faster time-to-mastery</div>
              </div>
              <p className="text-sm text-black/80">
                Instant corrections mean you fix mistakes now, not days later. Faster loops = faster learning.
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={300}>
            <div className="rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-white p-5 shadow-lg">
              <h3 className="text-lg font-bold mb-3 text-green-600">Personalized Pacing</h3>
              <div className="mb-3">
                <AnimatedCounter value={2} suffix="σ" className="text-4xl font-bold text-green-600" />
                <div className="text-xs text-black/70 mt-1">Bloom's 2-sigma problem solved</div>
              </div>
              <p className="text-sm text-black/80">
                One-on-one tutoring is 2 standard deviations better than group classes. Studi scales that.
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={400}>
            <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 shadow-lg">
              <h3 className="text-lg font-bold mb-3 text-orange-600">Context Awareness</h3>
              <div className="mb-3">
                <div className="text-4xl font-bold text-orange-600">100%</div>
                <div className="text-xs text-black/70 mt-1">relevance to your current work</div>
              </div>
              <p className="text-sm text-black/80">
                Studi sees your canvas and code—guidance is specific, not generic.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={500}>
          <div className="rounded-xl border-2 border-black/20 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-center">How we compare</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="font-semibold">Feature</div>
              <div className="text-center font-semibold">Traditional</div>
              <div className="text-center font-semibold">Online Courses</div>
              <div className="text-center font-semibold text-blue-600">Studi</div>

              <div className="font-medium">Personalized</div>
              <div className="text-center">✗</div>
              <div className="text-center">✗</div>
              <div className="text-center text-green-600">✓</div>

              <div className="font-medium">Interactive</div>
              <div className="text-center text-orange-500">~</div>
              <div className="text-center">✗</div>
              <div className="text-center text-green-600">✓</div>

              <div className="font-medium">Instant Feedback</div>
              <div className="text-center">✗</div>
              <div className="text-center">✗</div>
              <div className="text-center text-green-600">✓</div>

              <div className="font-medium">Context-Aware</div>
              <div className="text-center">✗</div>
              <div className="text-center">✗</div>
              <div className="text-center text-green-600">✓</div>

              <div className="font-medium">Voice + Visual + Code</div>
              <div className="text-center">✗</div>
              <div className="text-center">✗</div>
              <div className="text-center text-green-600">✓</div>
            </div>
        </div>
        </Reveal>
      </div>
    </Section>
  );
}

// 6. TECHNICAL EDGE
function TechSection() {
  return (
    <Section>
      <GridBackground />
      <div className="mx-auto w-full max-w-5xl text-black">
        <Reveal>
          <div className="mb-6 text-3xl font-bold text-center">How we built it</div>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Reveal delayMs={100}>
              <div className="group rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
                <div className="font-bold text-blue-600 mb-2">Auto-context</div>
                <div className="text-sm text-black/70">JSON + small snapshot keep shared view synced—no heavy OCR.</div>
              </div>
            </Reveal>
            <Reveal delayMs={200}>
              <div className="group rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
                <div className="font-bold text-purple-600 mb-2">Typed tools</div>
                <div className="text-sm text-black/70">Safe, validated calls for Whiteboard, IDE, Notes with approval flows.</div>
              </div>
            </Reveal>
            <Reveal delayMs={300}>
              <div className="group rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5 shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
                <div className="font-bold text-green-600 mb-2">YAML renderer</div>
                <div className="text-sm text-black/70">Lessons, quizzes, widgets from one structured spec.</div>
              </div>
            </Reveal>
            <Reveal delayMs={400}>
              <div className="group rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
                <div className="font-bold text-orange-600 mb-2">Session gating & telemetry</div>
                <div className="text-sm text-black/70">Reliable behavior with full observability.</div>
              </div>
            </Reveal>
          </div>
          <Reveal delayMs={100}>
          <div>
            <ArchitectureDiagram />
          </div>
          </Reveal>
        </div>
        <Reveal delayMs={500}>
          <div className="mt-8 grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
            {["Next.js", "Convex", "Clerk", "Tailwind", "tldraw", "Pyodide", "Monaco", "OpenAI"].map((s, i) => (
              <div 
                key={s} 
                className="rounded-lg border border-black/15 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg font-medium"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {s}
              </div>
          ))}
        </div>
        </Reveal>
      </div>
    </Section>
  );
}

// 7. MARKET & GTM
function MarketSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-6xl text-black">
        <Reveal>
          <h2 className="mb-5 text-3xl font-bold text-center md:text-4xl">Market opportunity</h2>
        </Reveal>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <Reveal delayMs={100}>
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-white to-blue-50 p-5 shadow-lg border border-blue-100 transition-all hover:scale-105">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200 rounded-full blur-3xl opacity-30" />
              <div className="relative">
                <div className="text-4xl font-bold text-blue-600 mb-1">$90B</div>
                <div className="text-xs text-black/70 font-medium">US online education market</div>
              </div>
            </div>
          </Reveal>

          <Reveal delayMs={200}>
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 via-white to-purple-50 p-5 shadow-lg border border-purple-100 transition-all hover:scale-105">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200 rounded-full blur-3xl opacity-30" />
              <div className="relative">
                <div className="text-4xl font-bold text-purple-600 mb-1">3×</div>
                <div className="text-xs text-black/70 font-medium">STEM roles growth by 2030</div>
              </div>
            </div>
          </Reveal>

          <Reveal delayMs={300}>
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-50 via-white to-green-50 p-5 shadow-lg border border-green-100 transition-all hover:scale-105">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-200 rounded-full blur-3xl opacity-30" />
              <div className="relative">
                <AnimatedCounter value={60} suffix="%" className="text-4xl font-bold text-green-600" />
                <div className="text-xs text-black/70 font-medium">faster time-to-skill potential</div>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={400}>
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-4 text-center">Target & expansion strategy</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white p-4 shadow-lg">
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shadow-lg">1</div>
                <h4 className="text-base font-bold text-blue-600 mb-2">Starting Wedge</h4>
                <ul className="space-y-1 text-xs text-black/80">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>College + HS students in STEM</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>Self-learners, bootcamp grads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>Monthly subscription ($20-30)</span>
                  </li>
                </ul>
              </div>

              <div className="relative rounded-xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white p-4 shadow-lg">
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-lg">2</div>
                <h4 className="text-base font-bold text-purple-600 mb-2">Next Phase</h4>
                <ul className="space-y-1 text-xs text-black/80">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500">•</span>
                    <span>Teams and bootcamps (B2B)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500">•</span>
                    <span>Shared boards, analytics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500">•</span>
                    <span>Per-seat licensing</span>
                  </li>
                </ul>
              </div>

              <div className="relative rounded-xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-white p-4 shadow-lg">
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold shadow-lg">3</div>
                <h4 className="text-base font-bold text-green-600 mb-2">Future</h4>
                <ul className="space-y-1 text-xs text-black/80">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    <span>Proof-of-skill service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    <span>Employer integrations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    <span>Credential partnerships</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delayMs={500}>
          <div className="rounded-xl border border-black/15 bg-white p-5 shadow-lg">
            <h3 className="text-lg font-bold mb-3">Go-to-Market Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold text-blue-600 mb-2 text-sm">🎯 Distribution Channels</div>
                <ul className="space-y-1 text-xs text-black/70">
                  <li>• Organic UGC on TikTok/Instagram</li>
                  <li>• Campus ambassadors program</li>
                  <li>• Discord community for study sprints</li>
                  <li>• Weekly task drops and challenges</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-purple-600 mb-2 text-sm">📊 Conversion Strategy</div>
                <ul className="space-y-1 text-xs text-black/70">
                  <li>• Waitlist → beta signup</li>
                  <li>• Free trial (7 days)</li>
                  <li>• Student plan + pro tier</li>
                  <li>• Show speed metrics vs courses</li>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// 8. TRACTION
function TractionSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-5xl text-black">
        <Reveal>
          <h2 className="mb-10 text-4xl font-bold text-center md:text-5xl">Current traction</h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Reveal delayMs={100}>
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-white p-8 border border-blue-200 shadow-lg text-center">
              <AnimatedCounter value={53} className="text-5xl font-bold text-blue-600" />
              <div className="mt-3 text-sm font-medium text-black/70">on waitlist</div>
            </div>
          </Reveal>

          <Reveal delayMs={200}>
            <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-white p-8 border border-purple-200 shadow-lg text-center">
              <div className="text-5xl font-bold text-purple-600">✓</div>
              <div className="mt-3 text-sm font-medium text-black/70">Working demo</div>
            </div>
          </Reveal>

          <Reveal delayMs={300}>
            <div className="rounded-2xl bg-gradient-to-br from-green-50 to-white p-8 border border-green-200 shadow-lg text-center">
              <div className="text-5xl font-bold text-green-600">35%</div>
              <div className="mt-3 text-sm font-medium text-black/70">faster solve times (early tests)</div>
          </div>
          </Reveal>
        </div>

        <Reveal delayMs={400}>
          <div className="rounded-2xl border-2 border-black/15 bg-white p-8 shadow-xl">
            <h3 className="text-xl font-bold mb-4">What we're measuring:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-white border border-blue-100">
                <div className="font-semibold text-blue-600 mb-2">📊 Time-to-skill</div>
                <div className="text-sm text-black/70">How long to solve representative problems</div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-white border border-purple-100">
                <div className="font-semibold text-purple-600 mb-2">💡 Hint rate decay</div>
                <div className="text-sm text-black/70">Fewer, more targeted hints over time</div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-white border border-green-100">
                <div className="font-semibold text-green-600 mb-2">✅ Quiz outcomes</div>
                <div className="text-sm text-black/70">Accuracy and retention metrics</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// 9. ROADMAP
function RoadmapSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-5xl text-black">
        <Reveal>
          <h2 className="mb-10 text-4xl font-bold text-center md:text-5xl">Roadmap</h2>
        </Reveal>
        <Timeline
          left={{
            title: "Where we are",
            items: [
              "Integrated demo: voice + whiteboard + IDE + lesson page",
              "53 on waitlist, active demos happening",
              "Early users showing 30-40% faster solve times",
              "Current limits: no persistence, single-language only",
            ],
          }}
          right={[
            { 
              title: "0–30 days", 
              color: "green", 
              items: [
                "Ship public beta",
                "Auth, sessions, reliability polish",
                "Telemetry and guardrails",
                "UGC content push"
              ] 
            },
            { 
              title: "1–3 months", 
              color: "blue", 
              items: [
                "Multi-language code (Judge0)",
                "Persistence: files, runs, notes",
                "Learning records and analytics",
                "Team features (shared boards)"
              ] 
            },
            { 
              title: "3–6 months", 
              items: [
                "Educator pilots (bootcamps, schools)",
                "Skill transcripts (proof layer)",
                "First employer partnerships",
                "Discord community at 1K+ active"
              ] 
            },
          ]}
        />
      </div>
    </Section>
  );
}

// 10. VISION
function VisionSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-5xl text-center text-black">
        <Reveal>
          <h2 className="mb-8 text-4xl font-bold md:text-5xl">The vision</h2>
        </Reveal>
        
        <Reveal delayMs={100}>
          <div className="mb-10 mx-auto max-w-3xl">
            <p className="text-2xl leading-relaxed text-black/80 font-medium">
              "Replace the degree-then-apply pipeline."
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <Reveal delayMs={200}>
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-8 shadow-lg text-left">
              <div className="text-4xl mb-4">🎓</div>
              <h3 className="text-2xl font-bold mb-4 text-blue-600">For Learners</h3>
              <p className="text-black/80 leading-relaxed">
                Learn on your own terms. Get personal, real-time coaching. Build artifacts that prove your skills. 
                No more memorizing for tests you'll forget.
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={300}>
            <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-8 shadow-lg text-left">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-2xl font-bold mb-4 text-purple-600">For Employers</h3>
              <p className="text-black/80 leading-relaxed">
                Hire based on what candidates can DO, not where they went to school. 
                See real code, diagrams, and problem-solving in action.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={400}>
          <div className="rounded-3xl border-2 border-black/20 bg-gradient-to-br from-black/5 via-white to-black/5 p-10 shadow-2xl">
            <blockquote className="text-3xl font-semibold text-black leading-relaxed">
              "Smart people self-learn. We're making that path real—and giving employers the proof they need to trust it."
              <footer className="mt-6 text-lg text-black/60 font-normal">— Naval Ravikant (paraphrased)</footer>
            </blockquote>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function TeamSection() {
  const people = [
    { name: "Kasuthub Nandimandalam", role: "Founder, CEO/CTO" },
    { name: "Tristan Gtamenni", role: "Marketing" },
    { name: "Akhil Goslas", role: "Engineering" },
  ];
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-4xl text-center text-black">
        <div className="mb-6 text-2xl font-semibold">Team</div>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {people.map((p) => (
            <div key={p.name} className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-black/20 bg-white text-xl font-semibold shadow-sm">
                {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-black/70">{p.role}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CTASection() {
  useConfettiOnce();
  return (
    <Section>
      <GridBackground />
      <CTA />
    </Section>
  );
}

export default function PitchPage() {
  // Build sections array following the pitch guideline structure
  const sections: Array<SectionSpec> = [
    { id: "preload", label: "Preload", render: () => <PreloadSection /> },
    { id: "intro", label: "1. Intro", render: () => <IntroSection /> },
    { id: "problem", label: "2. Problem", render: () => <ProblemSection /> },
    { id: "solution", label: "3. Solution", render: () => <SolutionSection /> },
    { id: "demo", label: "4. Demo", render: () => <DemoSection /> },
    { id: "why-it-works", label: "5. Why it works", render: () => <WhyItWorksSection /> },
    { id: "tech", label: "6. Technical edge", render: () => <TechSection /> },
    { id: "market", label: "7. Market & GTM", render: () => <MarketSection /> },
    { id: "traction", label: "8. Traction", render: () => <TractionSection /> },
    { id: "roadmap", label: "9. Roadmap", render: () => <RoadmapSection /> },
    { id: "vision", label: "10. Vision", render: () => <VisionSection /> },
    { id: "team", label: "Team", render: () => <TeamSection /> },
    { id: "cta", label: "The Ask", render: () => <CTASection /> },
  ];

  return (
    <>
      <LaserPointer enabled />
      <PresenterHUD current={0} total={sections.length} mode="presentation" />
      <PageController sections={sections} />
    </>
  );
}


