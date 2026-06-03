import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeJson } from "@/features/ai/components/chat/message/chat-message-utils";
import type {
	IngestAgentRunViewModel,
	IngestOutputEntry,
	IngestTokenTotals,
} from "./types";

interface OutputPanelLogsProps {
	rawStreamText: string;
	selectedStageId: string | null;
	selectedStageLabel: string | null;
	tokenTotals: IngestTokenTotals;
	rawOutput: string;
	filteredEntries: IngestOutputEntry[];
	filteredAgents: IngestAgentRunViewModel[];
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

	useEffect(() => {
		if (!showDebug && rawPreRef.current && rawStreamText) {
			rawPreRef.current.scrollTop = rawPreRef.current.scrollHeight;
		}
	}, [rawStreamText, showDebug]);

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
					{rawStreamText || "Waiting for stream..."}
				</pre>
			)}
		</div>
	);
}
