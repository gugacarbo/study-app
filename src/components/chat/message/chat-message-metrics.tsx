import type { AssistantPerfMetrics } from "./chat-message-utils";

export function ChatMessageMetrics({
	metrics,
}: {
	metrics: AssistantPerfMetrics;
}) {
	return (
		<p className="px-1 text-[11px] text-muted-foreground">
			TTFT: {(metrics.ttftMs / 1000).toFixed(2)}s •{" "}
			{metrics.tokensPerSecond.toFixed(1)} tok/s
			{metrics.inputTokens != null &&
				metrics.outputTokens != null &&
				` • in: ${metrics.inputTokens} • out: ${metrics.outputTokens}`}
			{metrics.isStreaming ? " • ao vivo" : ""}
		</p>
	);
}
