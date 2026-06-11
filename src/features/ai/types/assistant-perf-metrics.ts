export interface AssistantPerfMetrics {
	ttftMs: number;
	tokensPerSecond: number;
	isStreaming: boolean;
	inputTokens?: number;
	outputTokens?: number;
	/** Epoch ms when the response completed */
	respondedAt?: number;
	/** Total ms from user message sent to response complete */
	totalResponseMs?: number;
}
