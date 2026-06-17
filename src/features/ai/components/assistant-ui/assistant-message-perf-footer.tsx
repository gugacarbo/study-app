import { useAuiState } from "@assistant-ui/react";
import {
	formatChatMessagePerfLine,
	getAssistantMessagePerfView,
} from "@/features/ai/lib/chat-message-perf";

export function AssistantMessagePerfFooter() {
	const status = useAuiState((state) => state.message.status);
	const metadata = useAuiState((state) => state.message.metadata);
	const role = useAuiState((state) => state.message.role);
	const createdAt = useAuiState((state) => state.message.createdAt);

	if (role !== "assistant") return null;
	if (
		!status ||
		status.type === "running" ||
		status.type === "requires-action"
	) {
		return null;
	}

	const perf = getAssistantMessagePerfView({
		metadata,
		role,
		completedAtMs: createdAt?.getTime(),
	});
	if (!perf.hasData) return null;

	const label = formatChatMessagePerfLine(perf);

	return (
		<p
			className="ms-2 mt-0.5 flex flex-wrap gap-x-1.5 text-[10px] leading-tight text-muted-foreground tabular-nums"
			title={label}
		>
			{label}
		</p>
	);
}
