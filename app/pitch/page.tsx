"use client";

import React, { useEffect } from "react";
import PageController, { type SectionSpec } from "./components/PageController";
import Section from "./components/Section";
import GridBackground from "./components/GridBackground";
import NumberStat from "./components/NumberStat";
import Chip from "./components/Chip";
import VideoEmbed from "./components/VideoEmbed";
import ArchitectureDiagram from "./components/ArchitectureDiagram";
import Timeline from "./components/Timeline";
import CTA from "./components/CTA";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Reveal from "./components/Reveal";
import { usePageNav } from "./components/pageNavContext";

// Helper: Paper plane icon
function PaperPlane() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-black/70" aria-hidden>
      <path d="M3 11L21 3L13 21L11 13L3 11Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
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

function HeroSection() {
  return (
    <Section>
      <GridBackground />
      <div className="relative w-full max-w-4xl text-center text-black">
        <div className="absolute -right-6 -top-10 animate-[float_3s_ease-in-out_infinite] motion-reduce:animate-none" aria-hidden>
          <PaperPlane />
        </div>
        <Reveal>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight md:text-6xl">Bring your learning to life.</h1>
        </Reveal>
        <Reveal delayMs={80}>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-black/80">
            Realtime AI tutor for interactive, personal, measurable learning.
          </p>
        </Reveal>
        <a
          href="#problem"
          className="inline-flex rounded-full bg-black px-6 py-3 text-white shadow transition hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          Start
        </a>
      </div>
    </Section>
  );
}

function ProblemSection() {
  return (
    <Section>
      <GridBackground />
      <div className="grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 text-black">
        <Reveal>
        <div className="rounded-2xl border border-black/15 bg-white p-6 shadow-sm">
          <div className="mb-2 text-sm uppercase tracking-wide text-black/60">Traditional</div>
          <ul className="list-disc space-y-2 pl-6">
            <li>Interactive with people.</li>
            <li>Not personalized. One pace for all.</li>
          </ul>
        </div>
        </Reveal>
        <Reveal delayMs={100}>
        <div className="rounded-2xl border border-black/15 bg-white p-6 shadow-sm">
          <div className="mb-2 text-sm uppercase tracking-wide text-black/60">Online</div>
          <ul className="list-disc space-y-2 pl-6">
            <li>Flexible and cheap to deliver.</li>
            <li>Not interactive. Mostly videos/text.</li>
            <li>Not personalized. Made for everyone.</li>
          </ul>
        </div>
        </Reveal>
      </div>

      <div className="mt-8 flex w-full max-w-4xl flex-col items-center gap-6 rounded-2xl border border-black/10 bg-white/80 p-6 text-center shadow-sm text-black">
        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-full bg-white p-6 shadow-inner">
            <NumberStat value={52} suffix="%" className="text-3xl font-bold" />
            <div className="text-sm text-black/70">grads work outside degree.</div>
          </div>
          <div className="rounded-full bg-white p-6 shadow-inner">
            <NumberStat value={15} suffix="%" className="text-3xl font-bold" />
            <div className="text-sm text-black/70">MOOCs finish under.</div>
          </div>
          <div className="rounded-full bg-white p-6 shadow-inner">
            <NumberStat value={60} suffix="%" className="text-3xl font-bold" />
            <div className="text-sm text-black/70">time-to-skill reduction.</div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function TargetSection() {
  return (
    <Section>
      <GridBackground />
      <div className="flex w-full max-w-4xl flex-col items-center gap-4 text-center text-black">
        <div className="text-2xl font-semibold">Target user</div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Reveal><Chip>STEM students and logic-heavy courses</Chip></Reveal>
          <Reveal delayMs={80}><Chip>Pain: long videos, low feedback</Chip></Reveal>
          <Reveal delayMs={160}><Chip>Need: instant guidance, personal path</Chip></Reveal>
        </div>
      </div>
    </Section>
  );
}

function SolutionSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-5xl text-center text-black">
        <h2 className="mb-4 text-3xl font-bold md:text-4xl">Learn by doing, minute by minute.</h2>
        <p className="mb-6 text-black/80">Draws diagrams. Runs and fixes code. Quizzes and summarizes.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { title: "Whiteboard", alt: "Whiteboard screenshot" },
            { title: "IDE", alt: "IDE screenshot" },
            { title: "Notes", alt: "Notes screenshot" },
          ].map((item) => (
            <Reveal key={item.title}>
            <div className="group relative overflow-hidden rounded-xl border border-black/15 bg-white p-4 shadow-sm transition will-change-transform [transform:perspective(800px)] hover:[transform:perspective(800px)_rotateX(3deg)_rotateY(-3deg)]">
              <div className="aspect-video w-full rounded-md bg-black/5" aria-label={item.alt} />
              <div className="mt-3 font-medium">{item.title}</div>
            </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-4 text-black/70">Outcome: personal help, instant feedback, saved artifacts.</div>
      </div>
    </Section>
  );
}

function DemoSection() {
  return (
    <Section>
      <GridBackground />
      <div className="grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-3 text-black">
        <div className="md:col-span-2">
          <VideoEmbed />
        </div>
        <div className="flex flex-col gap-4 text-black">
          <h3 className="text-xl font-semibold">Live demo stage</h3>
          <p className="text-black/80">Prefer the live flow? Launch the interactive demo.</p>
          <Link prefetch href="/test-app" className="rounded-full bg-black px-5 py-3 text-center text-white shadow hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">Open /test-app</Link>
          <div className="text-sm text-black/60">If live stalls, the video above serves as backup with captions.</div>
        </div>
      </div>
    </Section>
  );
}

function TechSection() {
  return (
    <Section>
      <GridBackground />
      <div className="mx-auto w-full max-w-5xl text-black">
        <div className="mb-4 text-2xl font-semibold">Technical edge</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-lg border border-black/15 bg-white p-3">Auto-context: JSON + small snapshot keep shared view synced.</div>
            <div className="rounded-lg border border-black/15 bg-white p-3">Typed tools: safe calls for Whiteboard, IDE, Notes.</div>
            <div className="rounded-lg border border-black/15 bg-white p-3">YAML renderer: lessons, quizzes, and widgets from one spec.</div>
            <div className="rounded-lg border border-black/15 bg-white p-3">Session gating and telemetry: reliable behavior.</div>
          </div>
          <div>
            <ArchitectureDiagram />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
          {["Next.js", "Convex", "Clerk", "Tailwind", "tldraw", "Pyodide", "Monaco"].map((s) => (
            <div key={s} className="rounded-md border border-black/15 bg-white px-3 py-2 shadow-sm">{s}</div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function MarketSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-5xl text-center text-black">
        <div className="mb-6 text-2xl font-semibold">Market and impact</div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-full bg-white p-8 shadow-inner">
            <NumberStat value={90} suffix="B" className="text-4xl font-bold" />
            <div className="text-sm text-black/70">US online education</div>
          </div>
          <div className="rounded-full bg-white p-8 shadow-inner">
            <div className="text-4xl font-bold">3×</div>
            <div className="text-sm text-black/70">STEM roles growth</div>
          </div>
          <div className="rounded-full bg-white p-8 shadow-inner">
            <NumberStat value={60} suffix="%" className="text-4xl font-bold" />
            <div className="text-sm text-black/70">faster time-to-skill</div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function RoadmapSection() {
  return (
    <Section>
      <GridBackground />
      <div className="w-full max-w-5xl text-black">
        <Timeline
          left={{
            title: "Progress",
            items: [
              "Integrated demo live: voice + board + IDE + notes.",
              "53 on waitlist.",
              "Today’s limits: no persistence or long-term memory yet.",
            ],
          }}
          right={[
            { title: "0–30 days", color: "green", items: ["auth, sessions, reliability, telemetry."] },
            { title: "1–3 months", color: "blue", items: ["multi-language runs, persistence, learning records."] },
            { title: "3–6 months", items: ["educator pilot, skill transcripts, feedback hub."] },
          ]}
        />
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
  // Build sections array
  const sections: Array<SectionSpec> = [
    { id: "preload", label: "Preload", render: () => <PreloadSection /> },
    { id: "hero", label: "Hero", render: () => <HeroSection /> },
    { id: "problem", label: "Problem", render: () => <ProblemSection /> },
    { id: "target", label: "Target user", render: () => <TargetSection /> },
    { id: "solution", label: "Solution", render: () => <SolutionSection /> },
    { id: "demo", label: "Demo", render: () => <DemoSection /> },
    { id: "tech", label: "Technical edge", render: () => <TechSection /> },
    { id: "market", label: "Market & impact", render: () => <MarketSection /> },
    { id: "roadmap", label: "Roadmap", render: () => <RoadmapSection /> },
    { id: "team", label: "Team", render: () => <TeamSection /> },
    { id: "cta", label: "Close + CTA", render: () => <CTASection /> },
  ];

  return <PageController sections={sections} />;
}

