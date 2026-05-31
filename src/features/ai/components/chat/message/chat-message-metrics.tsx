import type { AssistantPerfMetrics } from "./chat-message-utils";

export function ChatMessageMetrics({
	metrics,
	show,
}: {
	metrics?: AssistantPerfMetrics;
	show: boolean;
}) {
	// Hide if not meant for display or if no actual token data exists
	const hasMetrics =
		metrics?.inputTokens != null || metrics?.outputTokens != null;
	if (!show || !hasMetrics) {
		return null;
	}

	const ttft = `${(metrics.ttftMs / 1000).toFixed(2)}s`;
	const speed = `${metrics.tokensPerSecond.toFixed(1)} tok/s`;
	const input = String(metrics.inputTokens);
	const output = String(metrics.outputTokens);

	const timeLabel = metrics.respondedAt
		? new Date(metrics.respondedAt).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;
	const totalLabel = metrics.totalResponseMs
		? `${(metrics.totalResponseMs / 1000).toFixed(1)}s total`
		: null;

	return (
		<p className="px-1 text-[11px] text-muted-foreground">
			{timeLabel}
			{timeLabel && (ttft || totalLabel) ? " • " : ""}
			TTFT: {ttft} • {speed} • in: {input} • out: {output}
			{totalLabel ? ` • ${totalLabel}` : ""}
		</p>
	);
}
