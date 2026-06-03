import type { UIMessage } from "@tanstack/ai-client";
import { BotMessageSquare, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/ui/markdown";

interface SystemMessageProps {
	message: UIMessage;
}

export function SystemMessage({ message }: SystemMessageProps) {
	const [expanded, setExpanded] = useState(false);

	const textPart = message.parts.find((p) => p.type === "text");
	if (!textPart) return null;

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center gap-1.5 px-1">
				<BotMessageSquare
					className="size-3 shrink-0 text-slate-500"
					aria-hidden
				/>
				<span className="text-[0.625rem] uppercase tracking-wide text-slate-500">
					System Prompt
				</span>
			</div>

			<div className="relative rounded-lg border border-dashed border-slate-600 bg-slate-800/50">
				{/* Collapsed: 96px max-height with gradient mask */}
				{!expanded && (
					<div className="relative max-h-24 overflow-hidden px-4 pt-2.5 text-xs leading-relaxed text-slate-300 font-mono">
						<MarkdownRenderer content={textPart.content} />
						{/* Gradient mask at bottom, overlapping the trigger */}
						<div
							className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent to-slate-800 mask-[linear-gradient(to_bottom,transparent_30%,black_85%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_30%,black_100%)]"
							aria-hidden
						/>
						{/* Trigger button overlaid at the bottom of the collapsed box */}
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
						<div className="px-4 py-2.5 text-xs leading-relaxed text-slate-300 font-mono">
							<MarkdownRenderer content={textPart.content} />
						</div>
						{/* Trigger to collapse */}
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							className="flex w-full items-center justify-center gap-1.5 py-1.5 text-[0.625rem] uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-200"
						>
							<ChevronDownIcon
								className="size-3 shrink-0 rotate-180"
								aria-hidden
							/>
							Fechar
						</button>
					</>
				)}
			</div>
		</div>
	);
}
