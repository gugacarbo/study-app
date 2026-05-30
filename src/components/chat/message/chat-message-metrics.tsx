import type { AssistantPerfMetrics } from "./chat-message-utils";

export function ChatMessageMetrics({
	metrics,
	show,
}: {
	metrics?: AssistantPerfMetrics;
	show: boolean;
}) {
	if (!show) {
		return null;
	}

	const ttft = metrics ? `${(metrics.ttftMs / 1000).toFixed(2)}s` : "-";
	const speed = metrics
		? `${metrics.tokensPerSecond.toFixed(1)} tok/s`
		: "- tok/s";
	const input =
		metrics?.inputTokens != null ? String(metrics.inputTokens) : "-";
	const output =
		metrics?.outputTokens != null ? String(metrics.outputTokens) : "-";

	return (
		<p className="px-1 text-[11px] text-muted-foreground">
			TTFT: {ttft} • {speed} • in: {input} • out: {output}
			{metrics?.isStreaming ? " • ao vivo" : ""}
		</p>
	);
}
