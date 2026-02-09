/**
 * Cost Tracker Service for OpenAI Realtime API
 * 
 * Tracks token usage and calculates costs for voice agent sessions.
 * Designed to be reusable across playground and future main app integration.
 */

// Model pricing in USD per million tokens (as of Jan 2026)
export interface ModelPricing {
    audioInputPerMillionTokens: number;
    audioOutputPerMillionTokens: number;
    textInputPerMillionTokens: number;
    textOutputPerMillionTokens: number;
    cachedInputPerMillionTokens?: number;
}

// Known model pricing configurations
export const MODEL_PRICING: Record<string, ModelPricing> = {
    "gpt-realtime": {
        audioInputPerMillionTokens: 32,
        audioOutputPerMillionTokens: 64,
        textInputPerMillionTokens: 4,
        textOutputPerMillionTokens: 16,
        cachedInputPerMillionTokens: 0.4,
    },
    "gpt-4o-realtime-preview": {
        audioInputPerMillionTokens: 100,
        audioOutputPerMillionTokens: 200,
        textInputPerMillionTokens: 5,
        textOutputPerMillionTokens: 20,
        cachedInputPerMillionTokens: 2.5,
    },
    "gpt-4o-mini-realtime-preview": {
        audioInputPerMillionTokens: 10,
        audioOutputPerMillionTokens: 20,
        textInputPerMillionTokens: 0.6,
        textOutputPerMillionTokens: 2.4,
        cachedInputPerMillionTokens: 0.06,
    },
};

// Default to gpt-realtime if model not found
const DEFAULT_PRICING = MODEL_PRICING["gpt-realtime"];

// Token usage from a single response
export interface ResponseUsage {
    inputTokenDetails?: {
        text_tokens?: number;
        audio_tokens?: number;
        cached_tokens?: number;
    };
    outputTokenDetails?: {
        text_tokens?: number;
        audio_tokens?: number;
    };
    // Legacy flat fields (fallback)
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
}

// Cost breakdown for a response
export interface ResponseCost {
    audioInputTokens: number;
    audioOutputTokens: number;
    textInputTokens: number;
    textOutputTokens: number;
    cachedInputTokens: number;
    costUsd: number;
}

// Session-level cost summary
export interface SessionCosts {
    sessionId: string;
    startTime: number;
    endTime?: number;
    model: string;

    // Cumulative token counts
    audioInputTokens: number;
    audioOutputTokens: number;
    textInputTokens: number;
    textOutputTokens: number;
    cachedInputTokens: number;

    // Calculated costs
    totalCostUsd: number;
    responseCount: number;

    // Per-response breakdown (for detailed analysis)
    responses: ResponseCost[];
}

export type CostEventHandler = (cost: ResponseCost, session: SessionCosts) => void;

/**
 * Cost Tracker instance for a voice session
 */
export class CostTracker {
    private session: SessionCosts;
    private pricing: ModelPricing;
    private handlers: Set<CostEventHandler> = new Set();

    constructor(model: string = "gpt-realtime") {
        this.pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
        this.session = this.createEmptySession(model);
    }

    private createEmptySession(model: string): SessionCosts {
        return {
            sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            startTime: Date.now(),
            model,
            audioInputTokens: 0,
            audioOutputTokens: 0,
            textInputTokens: 0,
            textOutputTokens: 0,
            cachedInputTokens: 0,
            totalCostUsd: 0,
            responseCount: 0,
            responses: [],
        };
    }

    /**
     * Subscribe to cost events
     */
    onCost(handler: CostEventHandler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    /**
     * Calculate cost from token counts
     */
    private calculateCost(
        audioIn: number,
        audioOut: number,
        textIn: number,
        textOut: number,
        cached: number
    ): number {
        const p = this.pricing;
        return (
            (audioIn / 1_000_000) * p.audioInputPerMillionTokens +
            (audioOut / 1_000_000) * p.audioOutputPerMillionTokens +
            (textIn / 1_000_000) * p.textInputPerMillionTokens +
            (textOut / 1_000_000) * p.textOutputPerMillionTokens +
            (cached / 1_000_000) * (p.cachedInputPerMillionTokens || 0)
        );
    }

    /**
     * Process a response.done event from the Realtime API
     */
    processResponseDone(event: { response?: { usage?: ResponseUsage } }): ResponseCost | null {
        const usage = event?.response?.usage;
        if (!usage) return null;

        // Extract detailed token counts
        const audioIn = usage.inputTokenDetails?.audio_tokens || 0;
        const audioOut = usage.outputTokenDetails?.audio_tokens || 0;
        const textIn = usage.inputTokenDetails?.text_tokens || 0;
        const textOut = usage.outputTokenDetails?.text_tokens || 0;
        const cached = usage.inputTokenDetails?.cached_tokens || 0;

        const costUsd = this.calculateCost(audioIn, audioOut, textIn, textOut, cached);

        const responseCost: ResponseCost = {
            audioInputTokens: audioIn,
            audioOutputTokens: audioOut,
            textInputTokens: textIn,
            textOutputTokens: textOut,
            cachedInputTokens: cached,
            costUsd,
        };

        // Update session totals
        this.session.audioInputTokens += audioIn;
        this.session.audioOutputTokens += audioOut;
        this.session.textInputTokens += textIn;
        this.session.textOutputTokens += textOut;
        this.session.cachedInputTokens += cached;
        this.session.totalCostUsd += costUsd;
        this.session.responseCount++;
        this.session.responses.push(responseCost);

        // Notify handlers
        this.handlers.forEach((h) => {
            try {
                h(responseCost, this.getSessionSummary());
            } catch (e) {
                console.error("[CostTracker] Handler error:", e);
            }
        });

        return responseCost;
    }

    /**
     * Get current session costs summary
     */
    getSessionSummary(): SessionCosts {
        return { ...this.session, responses: [...this.session.responses] };
    }

    /**
     * Format cost as USD string
     */
    static formatUsd(amount: number): string {
        if (amount < 0.01) {
            return `$${amount.toFixed(4)}`;
        }
        return `$${amount.toFixed(2)}`;
    }

    /**
     * End the session and return final summary
     */
    endSession(): SessionCosts {
        this.session.endTime = Date.now();
        return this.getSessionSummary();
    }

    /**
     * Reset for a new session
     */
    reset(model?: string): void {
        this.session = this.createEmptySession(model || this.session.model);
        if (model && MODEL_PRICING[model]) {
            this.pricing = MODEL_PRICING[model];
        }
    }

    /**
     * Get duration in seconds
     */
    getDurationSeconds(): number {
        const end = this.session.endTime || Date.now();
        return Math.round((end - this.session.startTime) / 1000);
    }
}

/**
 * Create a new cost tracker instance
 */
export function createCostTracker(model?: string): CostTracker {
    return new CostTracker(model);
}
