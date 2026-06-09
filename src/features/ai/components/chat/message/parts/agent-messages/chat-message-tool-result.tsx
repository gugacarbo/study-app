import type { ToolResultViewModel } from "../../chat-message-utils";
import {
	formatToolPayload,
	isLoadingToolState,
	toneFromState,
} from "../../chat-message-utils";
import { DetailAccordion } from "../../detail-accordion/detail-accordion";
import {
	DetailPayloadBlock,
	DetailPayloadSection,
} from "../../detail-accordion/detail-payload-section";

export function ChatMessageToolResult({ part }: { part: ToolResultViewModel }) {
	const content = formatToolPayload(part.content);
	const error = typeof part.error === "string" ? part.error : undefined;
	const isLoading = isLoadingToolState(part.state);

	return (
		<DetailAccordion
			value="tool-result"
			label="Tool result"
			tone={toneFromState(
				typeof part.state === "string" ? part.state : "unknown",
			)}
			isLoading={isLoading}
		>
			{content ? (
				<DetailPayloadSection error={error}>
					<DetailPayloadBlock label="Result">{content}</DetailPayloadBlock>
				</DetailPayloadSection>
			) : error ? (
				<p className="text-[11px] font-medium leading-snug text-red-400">
					{error}
				</p>
			) : null}
		</DetailAccordion>
	);
}
