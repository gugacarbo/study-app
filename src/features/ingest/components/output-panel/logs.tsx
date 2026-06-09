import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeJson } from "@/features/ai/components/chat/message/chat-message-utils";
import type {
	IngestAgentRunViewModel,
	IngestOutputEntry,
	IngestTokenTotals,
} from "../types";

interface OutputPanelLogsProps {
	rawStreamText: string;
	selectedStageId: string | null;
	selectedStageLabel: string | null;
	tokenTotals: IngestTokenTotals;
	rawOutput: string;
	filteredEntries: IngestOutputEntry[];
	filteredAgents: IngestAgentRunViewModel[];
}

function formatRawOutputEntry(entry: IngestOutputEntry): string {
	if (entry.kind === "event") {
		return `${entry.label}${entry.content ? `: ${entry.content}` : ""}`;
	}

	const label = entry.label ? `${entry.label} ` : "";
	return `${label}${entry.role.toUpperCase()}: ${entry.content}`;
}

function formatAgentMessage(agentName: string, agentState: string, message: IngestAgentRunViewModel["messages"][number]): string {
	const lines: string[] = [`[${agentName} | ${agentState} | ${message.role.toUpperCase()}]`];

	for (const part of message.parts) {
		if (part.type === "text") {
			if (part.content) lines.push(part.content);
			continue;
		}

		if (part.type === "tool-call") {
			lines.push(`TOOL CALL: ${part.name}`);
			if (part.arguments) lines.push(String(part.arguments));
			continue;
		}

		if (part.type === "tool-result") {
			lines.push(`TOOL RESULT (${part.toolCallId}):`);
			if (part.content) lines.push(String(part.content));
			if (part.error) lines.push(`ERROR: ${part.error}`);
		}
	}

	return lines.join("\n");
}

function buildRawTranscript({
	rawStreamText,
	rawOutput,
	filteredEntries,
	filteredAgents,
}: Pick<
	OutputPanelLogsProps,
	"rawStreamText" | "rawOutput" | "filteredEntries" | "filteredAgents"
>): string {
	const sections: string[] = [];

	if (filteredAgents.length > 0) {
		sections.push(
			filteredAgents
				.flatMap((agent) =>
					agent.messages.map((message) =>
						formatAgentMessage(agent.name, agent.state, message),
					),
				)
				.join("\n\n"),
		);
	}

	const standaloneEntries = filteredEntries
		.filter((entry) => entry.kind === "event" || entry.role !== "assistant")
		.map(formatRawOutputEntry);
	if (standaloneEntries.length > 0) {
		sections.push(standaloneEntries.join("\n\n"));
	}

	const fallbackText = rawStreamText.trim() || rawOutput.trim();
	if (sections.length === 0 && fallbackText) {
		sections.push(fallbackText);
	}

	return sections.filter(Boolean).join("\n\n");
}

export function OutputPanelLogs({
	rawStreamText,
	selectedStageId,
	selectedStageLabel,
	tokenTotals,
	rawOutput,
	filteredEntries,
	filteredAgents,
}: OutputPanelLogsProps) {
	const [showDebug, setShowDebug] = useState(false);
	const rawPreRef = useRef<HTMLPreElement>(null);
	const rawTranscript = buildRawTranscript({
		rawStreamText,
		rawOutput,
		filteredEntries,
		filteredAgents,
	});

	useEffect(() => {
		if (!showDebug && rawPreRef.current && rawTranscript) {
			rawPreRef.current.scrollTop = rawPreRef.current.scrollHeight;
		}
	}, [rawTranscript, showDebug]);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="ml-auto h-6 px-2 text-[0.625rem] text-muted-foreground hover:bg-accent hover:text-foreground"
					onClick={() => setShowDebug((v) => !v)}
				>
					{showDebug ? "Back to raw" : "Debug JSON"}
				</Button>
			</div>
			{showDebug ? (
				<pre className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 text-[0.65rem] leading-relaxed whitespace-pre-wrap text-foreground/80">
					{safeJson({
						stageId: selectedStageId,
						stageLabel: selectedStageLabel,
						tokenTotals,
						rawOutput,
						entries: filteredEntries,
						agents: filteredAgents,
					})}
				</pre>
			) : (
				<pre
					ref={rawPreRef}
					className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 text-[0.7rem] leading-relaxed whitespace-pre-wrap text-foreground/80"
				>
					{rawTranscript || "Waiting for stream..."}
				</pre>
			)}
		</div>
	);
}
