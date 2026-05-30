import type { ToolResultViewModel } from "../../chat-message-utils";
import {
	isLoadingToolState,
	labelForToolState,
	safeJson,
	toneFromState,
} from "../../chat-message-utils";
import { DetailAccordion } from "../../detail-accordion/detail-accordion";

export function ChatMessageToolResult({ part }: { part: ToolResultViewModel }) {
	const stateLabel = labelForToolState(part.state);
	const content =
		typeof part.content === "string" ? part.content : safeJson(part.content);
	const error = typeof part.error === "string" ? part.error : undefined;
	const isLoading = isLoadingToolState(part.state);

	return (
		<DetailAccordion
			value="tool-result"
			label={`Tool result (${stateLabel})`}
			tone={toneFromState(
				typeof part.state === "string" ? part.state : "unknown",
			)}
			isLoading={isLoading}
		>
			<pre className="max-h-56 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
				{content}
			</pre>
			{error ? (
				<p className="text-[11px] font-medium text-muted-foreground">{error}</p>
			) : null}
		</DetailAccordion>
	);
}
