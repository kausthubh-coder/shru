# Test App (`/test-app`)

The prototype lives entirely in `app/test-app/page.tsx`. It brings together:

- A tldraw whiteboard
- A simple Python scratchpad using Monaco + Pyodide (multiple floating windows)
- A mini IDE workspace (tabs, content editing)
- A voice agent powered by OpenAI Realtime with a toolbelt to operate the board/IDE
- A live logs panel

## Try it

1. Ensure env vars are set (see README) and run `npm run dev`.
2. Open `http://localhost:3000/test-app`.
3. Click "Start" in the AI Voice Agent dock. Grant microphone permission.
4. Speak to the agent: ask it to draw shapes, arrange items, or create a simple diagram.
5. Toggle tabs (Whiteboard / Code / Notes) to use the IDE or write markdown notes.

## Controls

- Start/Stop/Mute the agent from the dock (bottom-right)
- Open logs (top-right) to see events
- Use “Show Context” to inspect the exact JSON `view_context` and the viewport screenshot sent to the model
- Use “Show Calls” to see every tool call with name, rid, timing, and errors
- Add Python windows from the sidebar or via the `create_python_window` tool
- Drag/resize Python windows; click Run to execute code via Pyodide

## How the agent “sees” the board

The page periodically sends:

- `view_context` — a compact JSON summary of visible shapes and selections
- `input_image` — a viewport-bounded screenshot as a data URL

The agent uses these to reason about layout without expensive OCR.

## Caveats

- This is a prototype. Expect rough edges in tool reliability and error handling.
- First response is gated until the session prompt and audio config are applied. If you see unexpected behavior on the very first turn, check the logs for `session.update` before `response.create`.
- Audio playback may require a user gesture in some browsers; the page attempts to auto-play output audio after Start.


