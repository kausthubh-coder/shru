/**
 * Typed event bus for playground observability
 * Enables real-time debugging and logging of agent interactions
 */


export type PlaygroundEventMap = {
  // Voice agent events
  "voice:connecting": { ts: number };
  "voice:connected": { ts: number };
  "voice:disconnected": { ts: number };
  "voice:speech_start": { ts: number };
  "voice:speech_end": { ts: number; transcript?: string };
  "voice:agent_speaking": { ts: number; speaking: boolean };
  "voice:error": { ts: number; error: string };

  // Planner agent events
  "planner:start": { ts: number; intent: string; model: string };
  "planner:thinking": { ts: number; step: number };
  "planner:tool_call": { ts: number; name: string; args: unknown };
  "planner:tool_result": { ts: number; name: string; result: unknown; durationMs: number };
  "planner:done": { ts: number; result: unknown; durationMs: number; toolCalls: number };
  "planner:error": { ts: number; error: string };

  // Tool execution events
  "tool:start": { ts: number; name: string; args: unknown };
  "tool:done": { ts: number; name: string; result: unknown; durationMs: number };
  "tool:error": { ts: number; name: string; error: string; durationMs: number };

  // Context events
  "context:gathered": { ts: number; spaces: string[]; charCount: number; hasImage: boolean };
  "context:sent": { ts: number };

  // General playground events
  "playground:config_changed": { ts: number; key: string; value: unknown };
  "playground:architecture_changed": { ts: number; architecture: string };

  // Cost tracking events
  "cost:response": {
    ts: number;
    audioInputTokens: number;
    audioOutputTokens: number;
    textInputTokens: number;
    textOutputTokens: number;
    cachedInputTokens: number;
    responseCostUsd: number;
  };
  "cost:session_total": {
    ts: number;
    sessionId: string;
    totalCostUsd: number;
    responseCount: number;
    durationSeconds: number;
  };
};

export type PlaygroundEventType = keyof PlaygroundEventMap;
export type PlaygroundEvent<T extends PlaygroundEventType = PlaygroundEventType> = {
  type: T;
  data: PlaygroundEventMap[T];
};

type EventHandler<T extends PlaygroundEventType> = (data: PlaygroundEventMap[T]) => void;
type WildcardHandler = (event: PlaygroundEvent) => void;

export class PlaygroundEventBus {
  private handlers: Map<PlaygroundEventType, Set<EventHandler<any>>> = new Map();
  private wildcardHandlers: Set<WildcardHandler> = new Set();
  private eventLog: PlaygroundEvent[] = [];
  private maxLogSize = 500;

  /**
   * Subscribe to a specific event type
   */
  on<T extends PlaygroundEventType>(type: T, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  /**
   * Subscribe to all events (for logging/debugging)
   */
  onAll(handler: WildcardHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => this.wildcardHandlers.delete(handler);
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends PlaygroundEventType>(type: T, handler: EventHandler<T>): void {
    this.handlers.get(type)?.delete(handler);
  }

  /**
   * Emit an event
   */
  emit<T extends PlaygroundEventType>(type: T, data: Omit<PlaygroundEventMap[T], "ts">): void {
    const fullData = { ...data, ts: Date.now() } as PlaygroundEventMap[T];
    const event: PlaygroundEvent<T> = { type, data: fullData };

    // Add to log
    this.eventLog.unshift(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.pop();
    }

    // Notify specific handlers
    this.handlers.get(type)?.forEach((handler) => {
      try {
        handler(fullData);
      } catch (e) {
        console.error(`[EventBus] Handler error for ${type}:`, e);
      }
    });

    // Notify wildcard handlers
    this.wildcardHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (e) {
        console.error(`[EventBus] Wildcard handler error:`, e);
      }
    });
  }

  /**
   * Get the event log
   */
  getLog(): PlaygroundEvent[] {
    return [...this.eventLog];
  }

  /**
   * Clear the event log
   */
  clearLog(): void {
    this.eventLog = [];
  }

  /**
   * Export log as JSON
   */
  exportLog(): string {
    return JSON.stringify(this.eventLog, null, 2);
  }
}

/**
 * Singleton event bus instance for the playground
 */
let globalEventBus: PlaygroundEventBus | null = null;

export function getPlaygroundEventBus(): PlaygroundEventBus {
  if (!globalEventBus) {
    globalEventBus = new PlaygroundEventBus();
  }
  return globalEventBus;
}

/**
 * Create a new event bus (for testing or isolated instances)
 */
export function createEventBus(): PlaygroundEventBus {
  return new PlaygroundEventBus();
}
