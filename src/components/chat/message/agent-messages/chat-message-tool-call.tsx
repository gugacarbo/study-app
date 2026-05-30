import type { ToolCallViewModel } from "../chat-message-utils";
import {
	labelForToolState,
	safeJson,
	toneFromState,
} from "../chat-message-utils";
import { DetailAccordion } from "../detail-accordion";

export function ChatMessageToolCall({ part }: { part: ToolCallViewModel }) {
	const name = typeof part.name === "string" ? part.name : "unknown_tool";
	const rawArgs =
		typeof part.arguments === "string" && part.arguments.trim().length > 0
			? part.arguments
			: undefined;
	const parsedInput = "input" in part ? part.input : undefined;
	const output = "output" in part ? part.output : undefined;
	const state = labelForToolState(part.state);
	const value = "tool-call";
	const defaultOpen = state !== "complete";

	return (
		<DetailAccordion
			value={value}
			label={`Tool call: ${name} (${state})`}
			tone={toneFromState(state)}
			defaultOpen={defaultOpen}
		>
			{rawArgs ? (
				<div>
					<p className="mb-1 text-[11px] font-medium text-muted-foreground">
						Arguments
					</p>
					<pre className="max-h-56 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
						{rawArgs}
					</pre>
				</div>
			) : null}
			{parsedInput !== undefined ? (
				<div>
					<p className="mb-1 text-[11px] font-medium text-muted-foreground">
						Parsed input
					</p>
					<pre className="max-h-56 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
						{safeJson(parsedInput)}
					</pre>
				</div>
			) : null}
			{output !== undefined ? (
				<div>
					<p className="mb-1 text-[11px] font-medium text-muted-foreground">
						Output
					</p>
					<pre className="max-h-56 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
						{safeJson(output)}
					</pre>
				</div>
			) : null}
		</DetailAccordion>
	);
}
