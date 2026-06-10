import type { UIMessage } from "@tanstack/ai-client";
import {
	buildAgentWorkSummary,
	type GroupedAgentMessagePart,
	resolveAgentWorkPresentation,
} from "../../chat-message-utils";
import { DetailAccordion } from "../../detail-accordion/detail-accordion";
import { AgentMessages } from "./agent-messages";

function buildAgentWorkPartKey(
	groupedPart: GroupedAgentMessagePart,
	blockIndex: number,
	index: number,
): string {
	if (groupedPart.kind === "tool-call") {
		const resultState = groupedPart.toolResult?.state ?? "pending";
		return `${blockIndex}:${index}:tool-call:${groupedPart.toolCall.id}:${resultState}`;
	}

	return `${blockIndex}:${index}:${groupedPart.kind}:${groupedPart.index}`;
}

export function ChatMessageAgentWork({
	parts,
	blockIndex,
	messageParts,
	messageIsPending = false,
}: {
	parts: GroupedAgentMessagePart[];
	blockIndex: number;
	messageParts?: UIMessage["parts"];
	messageIsPending?: boolean;
}) {
	const label = buildAgentWorkSummary(parts);
	const { tone, isLoading, defaultOpen } = resolveAgentWorkPresentation(parts);

	return (
		<DetailAccordion
			value={`agent-work-${blockIndex}`}
			label={label}
			tone={tone}
			isLoading={isLoading}
			defaultOpen={defaultOpen}
			className="border-0 px-0"
		>
			<div className="flex flex-col gap-1">
				{parts.map((groupedPart, index) => (
					<AgentMessages
						key={buildAgentWorkPartKey(groupedPart, blockIndex, index)}
						groupedPart={groupedPart}
						messageParts={messageParts}
						messageIsPending={messageIsPending}
					/>
				))}
			</div>
		</DetailAccordion>
	);
}
