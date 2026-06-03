import type { UIMessage } from "@tanstack/ai-client";
import { BotMessageSquare, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

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
				{/* Collapsed: 64px max-height with gradient mask */}
				{!expanded && (
					<div
						className={cn(
							"relative overflow-hidden px-4 pt-2.5 text-xs leading-relaxed text-slate-300 font-mono",
							"max-h-16",
						)}
						style={{ maxHeight: "4rem" }}
					>
						<MarkdownRenderer content={textPart.content} />
						{/* Gradient mask at bottom */}
						<div
							className="pointer-events-none absolute inset-0"
							style={{
								background:
									"linear-gradient(to bottom, transparent 30%, #1e293b 100%)",
								maskImage:
									"linear-gradient(to bottom, transparent 0px, black 24px)",
								WebkitMaskImage:
									"linear-gradient(to bottom, transparent 0px, black 24px)",
							}}
							aria-hidden
						/>
					</div>
				)}

				{/* Expanded: full content */}
				{expanded && (
					<div className="px-4 py-2.5 text-xs leading-relaxed text-slate-300 font-mono">
						<MarkdownRenderer content={textPart.content} />
					</div>
				)}

				{/* Trigger button */}
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className={cn(
						"flex w-full items-center justify-center gap-1.5 py-1.5 text-[0.625rem] uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-200",
						!expanded && "rounded-b-lg bg-slate-800/50",
					)}
				>
					{!expanded ? (
						<>
							<ChevronDownIcon className="size-3 shrink-0" aria-hidden />
							Abrir mensagem
						</>
					) : (
						<>
							<ChevronDownIcon
								className="size-3 shrink-0 rotate-180"
								aria-hidden
							/>
							Fechar
						</>
					)}
				</button>
			</div>
		</div>
	);
}
