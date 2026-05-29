import type { UIMessage } from "@tanstack/ai-client";
import { MarkdownRenderer } from "@/components/ui/markdown";

export interface AssistantPerfMetrics {
	ttftMs: number;
	tokensPerSecond: number;
	isStreaming: boolean;
}

type ParsedPart =
	| { type: "text"; content: string }
	| { type: "think"; content: string };

function parseTextParts(content: string): ParsedPart[] {
	const parts: ParsedPart[] = [];
	const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
	let lastIndex = 0;

	while (true) {
		const match = thinkRegex.exec(content);
		if (!match) break;
		if (match.index > lastIndex) {
			const text = content.slice(lastIndex, match.index).trim();
			if (text) {
				parts.push({ type: "text", content: text });
			}
		}

		const thinkContent = (match[1] || "").trim();
		if (thinkContent) {
			parts.push({ type: "think", content: thinkContent });
		}

		lastIndex = thinkRegex.lastIndex;
	}

	if (lastIndex < content.length) {
		const tail = content.slice(lastIndex).trim();
		if (tail) {
			parts.push({ type: "text", content: tail });
		}
	}

	return parts.length > 0 ? parts : [{ type: "text", content }];
}

function bubbleMarkdownClass(role: UIMessage["role"]): string {
	if (role === "user") {
		return "prose-invert [&_a]:text-primary-foreground [&_a]:opacity-90 [&_blockquote]:border-primary-foreground/30 [&_code]:bg-primary-foreground/20";
	}
	return "";
}

export function ChatMessage({
	message,
	metrics,
}: {
	message: UIMessage;
	metrics?: AssistantPerfMetrics;
}) {
	const partOccurrence = new Map<string, number>();
	const parsedOccurrence = new Map<string, number>();

	return (
		<div
			className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
		>
			<div
				className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
			>
				<div
					className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
						message.role === "user"
							? "bg-primary text-primary-foreground"
							: "bg-card border border-border text-card-foreground"
					}`}
				>
					{message.parts.map((part) => {
						const partContent =
							part.type === "text" || part.type === "thinking"
								? part.content
								: "";
						const partBase = `${part.type}:${partContent}`;
						const partCount = (partOccurrence.get(partBase) ?? 0) + 1;
						partOccurrence.set(partBase, partCount);
						const partKey = `${message.id}:${partBase}:${partCount}`;

						return part.type === "text" ? (
							<div key={partKey} className="space-y-2">
								{parseTextParts(part.content).map((parsedPart) => {
									const parsedBase = `${partKey}:${parsedPart.type}:${parsedPart.content}`;
									const parsedCount =
										(parsedOccurrence.get(parsedBase) ?? 0) + 1;
									parsedOccurrence.set(parsedBase, parsedCount);
									const parsedKey = `${parsedBase}:${parsedCount}`;

									return parsedPart.type === "text" ? (
										<MarkdownRenderer
											key={parsedKey}
											content={parsedPart.content}
											className={bubbleMarkdownClass(message.role)}
										/>
									) : (
										<details
											key={parsedKey}
											className="rounded-md border border-border/60 bg-muted/40"
										>
											<summary className="list-none cursor-pointer select-none rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
												Raciocínio do modelo
											</summary>
											<p className="px-2 pb-2 whitespace-pre-wrap text-xs text-muted-foreground">
												{parsedPart.content}
											</p>
										</details>
									);
								})}
							</div>
						) : part.type === "thinking" ? (
							<span key={partKey} className="italic text-muted-foreground">
								{part.content}
							</span>
						) : null;
					})}
				</div>
			</div>
			{message.role === "assistant" && metrics && (
				<p className="mt-1 px-1 text-[11px] text-muted-foreground">
					TTFT: {(metrics.ttftMs / 1000).toFixed(2)}s •{" "}
					{metrics.tokensPerSecond.toFixed(1)} tok/s
					{metrics.isStreaming ? " • ao vivo" : ""}
				</p>
			)}
		</div>
	);
}
