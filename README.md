# Studi — Learn Faster. Prove Skills.

**A realtime, voice-first AI tutor that adapts to you—not the other way around.**

Studi replaces one-size-fits-all college models with hyper-personalized, hands-on learning. Currently delivering the **learn faster** part; proof of skill and credentials come later.

---

## 🎯 Mission

### 1. Learning (Live Now — Beta Focus)
A realtime, voice-first AI tutor that adapts minute-by-minute and collaborates with you on a shared whiteboard, inside an IDE, and on a lesson page. Hyper-personalized, hands-on, and context-aware.

### 2. Hiring (Planned — Not in Current Build)
Portable skill records and employer-friendly verification built on top of learning artifacts. **Coming after we nail the learning experience.**

---

## 🔥 The Problem

- **College content is static** and paced for the average learner
- Most tools stop at "completion," not true mastery
- Hiring over-indexes on degrees instead of demonstrated skill

---

## ✨ Our Solution

A **realtime, voice-first AI tutor** that sees what you're working on and teaches by doing:

### Hyper-Personalization
One learner at a time; adapts to your goals, knowledge gaps, and recent activity.

### Interactive Cognition
Teaches through drawing, coding, running examples, and generating lesson content on the fly.

### Context Awareness
Aware of your canvas, code, and lesson state to keep guidance grounded and specific.

---

## 🚀 Product Features (What's in the App Now)

### Realtime Voice Agent
- Natural conversation with the AI tutor
- Explains concepts, asks questions, and guides your next step
- English-first with language drift protection

### Shared Whiteboard (tldraw)
- Draw diagrams, derivations, and visual reasoning
- Agent can create, move, arrange, and label shapes
- Standalone text and shape labeling tools
- Camera controls and layout assistance

### IDE Workspace
- Full Monaco editor with syntax highlighting
- **Python execution via Pyodide** (client-side, no server needed)
- Real-time output panel with stdout/stderr
- Agent can read, edit, and run code with you

### Lesson Page (YAML-Driven)
The agent writes structured **YAML** specs that render:
- **Markdown explanations** (rich text, formatting, lists)
- **Inline quizzes & checkpoints** (MCQ with feedback)
- **Interactive inputs** (typed user inputs for practice)
- **Embedded widgets** (CodePen, StackBlitz, JSFiddle)
- Code blocks and runnable examples

### Interactive Notes
- Tied to what you're doing, not static lecture dumps
- YAML editor with live validation
- Side-by-side editor and rendered view

### Safety & Approvals
- Confirmations for destructive actions (e.g., clear canvas)
- Tool approval dialog system

---

## 🎓 Who It's For (Starting Wedge)

- **Self-learners** and professionals upskilling in STEM
- **College students** who want to master topics faster than course timelines
- **High school students** preparing for advanced coursework

---

## 💎 Differentiators

✓ **Hyper-personal, live instruction** — not static videos or fixed pacing  
✓ **Hands-on interactivity** — draw, code, run, and revise in one flow  
✓ **Context-aware tutoring** across whiteboard, code, and lesson state  
✓ **(Planned)** Verifiable skill outputs for hiring—added later on top of the learning loop

---

## 📊 Current Status

**Working Demo** with:
- ✅ Shared whiteboard with agent control
- ✅ IDE (Python first, more languages coming)
- ✅ YAML-driven lesson page
- ✅ Interactive notes with validation
- ✅ Realtime voice agent that can guide, draw, and debug
- ✅ Debug overlays (Context, Logs, Tool Calls)
- ✅ Basic confirmations for sensitive actions

**Pre-launch** with a waitlist; shipping beta to early users next.

---

## 🗺️ Near-Term Roadmap

- [ ] Public beta with early cohorts; tight feedback loop
- [ ] Multi-language code execution; safer server-side runs (Judge0)
- [ ] Persistence for files, runs, notes; lightweight learning analytics
- [ ] Harden auth, rate limits, reliability, and latency
- [ ] Early team/bootcamp use cases; pilot cohorts
- [ ] Prep for future skill transcripts/portfolios (design now, implement later)

> **Out of scope for now:** Employer credentials, external verifications, or hiring integrations. Those come **after** we nail the learning experience.

---

## 📈 Metrics We Care About

- **Time-to-skill:** How quickly learners solve representative problems
- **Hint rate & decay:** Fewer/more targeted hints over time
- **Quiz outcomes:** Checkpoint performance tied to lesson state
- **Retention:** Return sessions and progression across topics

---

## 🛠️ Technical Stack

This is a Next.js app backed by **Convex** and authenticated with **Clerk**. The experimental "Realtime Tutor" uses **OpenAI's Realtime API** to converse with users, draw on a **tldraw** whiteboard, and interact with a lightweight in-browser IDE (**Monaco + Pyodide**).

### Architecture Highlights

- **Auto-context per turn:** Compact JSON `workspace_context` (whiteboard + IDE + notes) + viewport screenshot
- **Unified prompt:** English-only, realtime-voice persona injected via `session.update`
- **Initialization gating:** Agent won't respond until session is configured (avoids early-turn drift)
- **Debug overlays:** "Show Context" (exact JSON + image sent) and "Show Calls" (tool call feed)
- **Modular tools:** Whiteboard, IDE, and Notes tools with telemetry and approval system

### What's Inside

```
├── app/
│   ├── test-app/              # Prototype UI (Whiteboard + Code + Notes tabs)
│   │   ├── agent/             # Session, runtime, tools registry
│   │   ├── components/        # UI panels and overlays
│   │   ├── lib/               # Pyodide, instructions, view context
│   │   ├── services/          # Auto-context sender with dedup/throttle
│   │   └── types/             # Tool contracts, YAML schemas
│   └── pitch/                 # Pitch deck page
├── convex/
│   ├── http.ts                # CORS + /realtime/token endpoint
│   ├── realtime.ts            # Mint OpenAI ephemeral client secrets
│   ├── schema.ts              # Database schema
│   └── myFunctions.ts         # Example queries/mutations
├── docs/                      # Architecture, coding standards, troubleshooting
└── components/
    └── ConvexClientProvider.tsx
```

---

## ⚡ Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Accounts:** Convex, Clerk, and OpenAI

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

**Next.js (`.env.local`):**

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
```

**Convex (Dashboard → Settings → Environment Variables):**

```env
OPENAI_API_KEY=sk-...
CLIENT_ORIGIN=http://localhost:3000  # Optional, for CORS
CLERK_JWT_ISSUER_DOMAIN=...          # Optional, if using Clerk auth in Convex
```

### 3. Start Dev Servers

```bash
npm run dev
```

This runs both Next.js and Convex in parallel.

### 4. Open the App

- **App home:** `http://localhost:3000/`
- **Realtime tutor prototype:** `http://localhost:3000/test-app`
  - Click "Start" in the AI Voice Agent dock
  - Grant microphone access
  - Toggle "Show Context" and "Show Calls" to inspect what the agent sees

---

## 🎮 How It Works

1. Client fetches an ephemeral OpenAI Realtime client secret from Convex via `GET /realtime/token`
2. Convex calls OpenAI API to mint the secret using `OPENAI_API_KEY`
3. Test page initializes a `RealtimeAgent` with WebRTC transport and registers tools
4. Agent receives compact whiteboard context + screenshot before each response
5. Agent speaks and acts via tool calls: create shapes, write code, generate lessons, etc.
6. A single operating prompt is injected via `session.update` (English-only, voice-first)

See `docs/test-app.md` for the full flow and complete tool list.

---

## 📚 Documentation

Comprehensive docs in the `docs/` folder:

- **[context.txt](docs/context.txt)** — Product vision, mission, and auto-context technical notes
- **[architecture.md](docs/architecture.md)** — System layers and data flow
- **[test-app.md](docs/test-app.md)** — How to use the prototype
- **[realtime-agent.md](docs/realtime-agent.md)** — Session setup, tools, audio config
- **[ide.md](docs/ide.md)** — IDE tools and Python execution
- **[notes.md](docs/notes.md)** — YAML schema and lesson rendering
- **[troubleshooting.md](docs/troubleshooting.md)** — Common issues and fixes

---

## 🔧 Scripts

```bash
npm run dev       # Run Next.js and Convex in parallel
npm run build     # Next.js production build
npm start         # Start Next.js in production
npm run lint      # Lint the Next.js app
```

---

## 🗂️ Key Files & Folders

### Frontend
- `app/layout.tsx` — Clerk and Convex providers
- `app/test-app/page.tsx` — Prototype UI (whiteboard, IDE, voice agent)
- `app/test-app/agent/session.ts` — Realtime session lifecycle
- `app/test-app/agent/registry.ts` — Tool registry
- `app/test-app/agent/tools/*` — Modular tool definitions

### Backend
- `convex/myFunctions.ts` — Sample query/mutation
- `convex/http.ts` — HTTP routes (CORS + `/realtime/token`)
- `convex/realtime.ts` — Mint OpenAI client secrets
- `convex/schema.ts` — Database schema

---

## 🚧 Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **LLM hallucination** | Ground responses in user context (whiteboard/code/lesson), show steps, add runnable checks |
| **Latency** | Cache hot paths, stream partials, minimize round trips, selective tool calls |
| **Scope creep to hiring** | Keep shipping cadence focused on learning loop; design future verifications, don't ship them yet |

---

## 🤝 Team & What We Need

- **Building now** — actively seeking early users (students, bootcamps, self-learners) for feedback
- **Looking for collaborators** on:
  - Runtime safety & sandboxing
  - Educational design for interactive lessons
  - Future credentialing standards (design phase only)

---

## 📞 Call to Action

### Join the Waitlist
Try the realtime tutor and YAML-driven lesson pages.

### Book a Demo
Bring a problem you're learning—let's measure **time-to-skill** together.

---

## 🎯 Next Steps (For Contributors)

- Harden auth on `/realtime/token` by requiring a logged-in user
- Add rate limiting per user
- Evolve the whiteboard toolset and agent prompts
- Move prototype logic from `app/test-app/page.tsx` into production features
- Explore Judge0 for server-side multi-language execution
- Build persistence layer for files, runs, and notes in Convex

For deeper technical details, explore the docs in `docs/`.

---

## 📄 License

[Your license here]

---

**Built with ❤️ for learners who refuse to settle for average.**

*Learn faster. Prove skills. Transform hiring.*
