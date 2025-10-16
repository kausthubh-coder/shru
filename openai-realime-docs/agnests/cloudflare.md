
Realtime Agents on Cloudflare

Cloudflare Workers and other workerd runtimes cannot open outbound WebSockets using the global WebSocket constructor. To simplify connecting Realtime Agents from these environments, the extensions package provides a dedicated transport that performs the fetch()-based upgrade internally.

Caution

This adapter is still in beta. You may run into edge case issues or bugs. Please report any issues via GitHub issues and we’ll fix quickly. For Node.js-style APIs in Workers, consider enabling nodejs_compat.
Setup

Install the extensions package.
Terminal window

npm install @openai/agents-extensions

Create a transport and attach it to your session.

import { CloudflareRealtimeTransportLayer } from '@openai/agents-extensions';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

const agent = new RealtimeAgent({
  name: 'My Agent',
});

// Create a transport that connects to OpenAI Realtime via Cloudflare/workerd's fetch-based upgrade.
const cfTransport = new CloudflareRealtimeTransportLayer({
  url: 'wss://api.openai.com/v1/realtime?model=gpt-realtime',
});

const session = new RealtimeSession(agent, {
  // Set your own transport.
  transport: cfTransport,
});

Connect your RealtimeSession.

await session.connect({ apiKey: 'your-openai-ephemeral-or-server-key' });

Notes

    The Cloudflare transport uses fetch() with Upgrade: websocket under the hood and skips waiting for a socket open event, matching the workerd APIs.
    All RealtimeSession features (tools, guardrails, etc.) work as usual when using this transport.
    Use DEBUG=openai-agents* to inspect detailed logs during development.
