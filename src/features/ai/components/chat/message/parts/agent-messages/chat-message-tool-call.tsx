import type {
	ToolCallViewModel,
	ToolResultViewModel,
} from "../../chat-message-utils";
import {
	formatToolPayload,
	resolveToolCallTriggerPresentation,
} from "../../chat-message-utils";
import { DetailAccordion } from "../../detail-accordion/detail-accordion";
import {
	DetailPayloadBlock,
	DetailPayloadSection,
} from "../../detail-accordion/detail-payload-section";

export function ChatMessageToolCall({
	part,
	toolResult,
}: {
	part: ToolCallViewModel;
	toolResult?: ToolResultViewModel;
}) {
	const name = typeof part.name === "string" ? part.name : "unknown_tool";
	const toolCallId = typeof part.id === "string" ? part.id : name;
	const parsedInput = "input" in part ? part.input : undefined;
	const rawArgs =
		typeof part.arguments === "string" ? part.arguments : undefined;
	const parsedInputText =
		formatToolPayload(parsedInput) ?? formatToolPayload(rawArgs);
	const parsedResultText =
		toolResult && formatToolPayload(toolResult.content);
	const resultError =
		toolResult && typeof toolResult.error === "string"
			? toolResult.error
			: undefined;
	const { tone, isLoading } = resolveToolCallTriggerPresentation(
		part,
		toolResult,
	);

	return (
		<DetailAccordion
			value={`tool-call-${toolCallId}`}
			label={`Tool call: ${name}`}
			tone={tone}
			isLoading={isLoading}
		>
			{parsedInputText ? (
				<DetailPayloadSection>
					<DetailPayloadBlock label="Input">{parsedInputText}</DetailPayloadBlock>
				</DetailPayloadSection>
			) : null}
			{parsedResultText ? (
				<DetailPayloadSection error={resultError}>
					<DetailPayloadBlock label="Result">
						{parsedResultText}
					</DetailPayloadBlock>
				</DetailPayloadSection>
			) : null}
		</DetailAccordion>
	);
}
