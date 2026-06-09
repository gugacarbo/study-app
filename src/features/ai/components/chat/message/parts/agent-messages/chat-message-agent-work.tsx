import type { UIMessage } from "@tanstack/ai-client";
import {
	buildAgentWorkSummary,
	resolveAgentWorkPresentation,
	type GroupedAgentMessagePart,
} from "../../chat-message-utils";
import { DetailAccordion } from "../../detail-accordion/detail-accordion";
import { AgentMessages } from "./agent-messages";

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
						key={`${blockIndex}:${index}:${groupedPart.kind}`}
						groupedPart={groupedPart}
						messageParts={messageParts}
						messageIsPending={messageIsPending}
					/>
				))}
			</div>
		</DetailAccordion>
	);
}
