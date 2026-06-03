import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import type { UIMessage } from "@tanstack/ai-client";
import { ChatMessage } from "./chat-message";

interface CollapsibleMessageProps {
	message: UIMessage;
	label: string;
	/** Minimum content length (in characters) to trigger collapsible behavior. Default: 200 */
	minLength?: number;
}

export function CollapsibleMessage({
	message,
	label,
	minLength = 200,
}: CollapsibleMessageProps) {
	const [expanded, setExpanded] = useState(false);

	const textPart = message.parts.find((p) => p.type === "text");
	const content = textPart?.content ?? "";
	const shouldCollapse = content.length >= minLength;

	if (!shouldCollapse) {
		return (
			<div className="flex flex-col gap-1">
				<div className="px-1 text-[0.625rem] uppercase tracking-wide text-slate-500">
					{label}
				</div>
				<ChatMessage message={message} />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			<div className="px-1 text-[0.625rem] uppercase tracking-wide text-slate-500">
				{label}
			</div>
			<div className="relative rounded-lg border border-dashed border-slate-600 bg-slate-800/50">
				{/* Collapsed: 96px max-height with gradient mask */}
				{!expanded && (
					<div
						className="relative overflow-hidden px-4 pt-2.5 text-xs leading-relaxed text-slate-300 font-mono"
						style={{ maxHeight: "6rem" }}
					>
						<ChatMessage message={message} />
						{/* Gradient mask at bottom */}
						<div
							className="pointer-events-none absolute inset-0"
							style={{
								background:
									"linear-gradient(to bottom, transparent 10%, #1e293b 100%)",
								maskImage:
									"linear-gradient(to bottom, transparent 30%, black 65%)",
								WebkitMaskImage:
									"linear-gradient(to bottom, transparent 30%, black 65%)",
							}}
							aria-hidden
						/>
						{/* Trigger button overlaid at the bottom */}
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-1.5 text-[0.625rem] uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-200"
						>
							<ChevronDownIcon className="size-3 shrink-0" aria-hidden />
							Abrir mensagem
						</button>
					</div>
				)}

				{/* Expanded: full content */}
				{expanded && (
					<>
						<div className="px-4 py-2.5">
							<ChatMessage message={message} />
						</div>
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							className="flex w-full items-center justify-center gap-1.5 py-1.5 text-[0.625rem] uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-200"
						>
							<ChevronDownIcon className="size-3 shrink-0 rotate-180" aria-hidden />
							Fechar
						</button>
					</>
				)}
			</div>
		</div>
	);
}
