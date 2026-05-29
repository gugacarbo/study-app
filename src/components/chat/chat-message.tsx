import type { UIMessage } from "@tanstack/ai-client";

type ParsedPart =
	| { type: "text"; content: string }
	| { type: "think"; content: string };

function parseTextParts(content: string): ParsedPart[] {
	const parts: ParsedPart[] = [];
	const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
	let lastIndex = 0;
	let match: RegExpExecArray | null = null;

	while ((match = thinkRegex.exec(content)) !== null) {
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

export function ChatMessage({ message }: { message: UIMessage }) {
	return (
		<div
			className={`flex ${
				message.role === "user" ? "justify-end" : "justify-start"
			}`}
		>
			<div
				className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
					message.role === "user"
						? "bg-primary text-primary-foreground"
						: "bg-card border border-border text-card-foreground"
				}`}
			>
				{message.parts.map((part, i) =>
					part.type === "text" ? (
						<div key={i} className="space-y-2">
							{parseTextParts(part.content).map((parsedPart, parsedIdx) =>
								parsedPart.type === "text" ? (
									<p key={`${i}-text-${parsedIdx}`}>{parsedPart.content}</p>
								) : (
									<details
										key={`${i}-think-${parsedIdx}`}
										className="rounded-md border border-border/60 bg-muted/40"
									>
										<summary className="list-none cursor-pointer select-none rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
											Raciocínio do modelo
										</summary>
										<p className="px-2 pb-2 whitespace-pre-wrap text-xs text-muted-foreground">
											{parsedPart.content}
										</p>
									</details>
								),
							)}
						</div>
					) : part.type === "thinking" ? (
						<span key={i} className="italic text-muted-foreground">
							{part.content}
						</span>
					) : null,
				)}
			</div>
		</div>
	);
}
