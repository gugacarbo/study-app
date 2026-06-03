import { ChevronDownIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import type { UIMessage } from "@tanstack/ai-client";
import { MarkdownRenderer } from "@/components/ui/markdown";

interface UserMessageProps {
	message: UIMessage;
}

export function UserMessage({ message }: UserMessageProps) {
	const [expanded, setExpanded] = useState(false);

	const textPart = message.parts.find((p) => p.type === "text");
	if (!textPart) return null;

	return (
		<div className="flex flex-col items-end gap-1.5">
			<div className="flex items-center gap-1.5 px-1">
				<UserIcon
					className="size-3 shrink-0 text-slate-500"
					aria-hidden
				/>
				<span className="text-[0.625rem] uppercase tracking-wide text-slate-500">
					User Prompt
				</span>
			</div>

			<div className="relative min-w-1/2 max-w-3/5 rounded-lg bg-primary px-4 py-2 text-sm leading-relaxed text-primary-foreground md:min-w-2/5">
				{/* Collapsed: 96px max-height with gradient mask */}
				{!expanded && (
					<div className="relative max-h-24 overflow-hidden">
						<MarkdownRenderer
							content={textPart.content}
							className="prose-invert [&_a]:text-primary-foreground [&_a]:opacity-90 [&_blockquote]:border-primary-foreground/30 [&_code]:bg-primary-foreground/20"
						/>
						{/* Gradient mask at bottom */}
						<div
							className="pointer-events-none absolute inset-0"
							style={{
								background:
									"linear-gradient(to bottom, transparent 30%, hsl(var(--primary)) 100%)",
							}}
							aria-hidden
						/>
						{/* Trigger button overlaid at the bottom of the collapsed box */}
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-1.5 text-[0.625rem] uppercase tracking-wide text-primary-foreground/70 transition-colors hover:text-primary-foreground"
						>
							<ChevronDownIcon className="size-3 shrink-0" aria-hidden />
							Abrir mensagem
						</button>
					</div>
				)}

				{/* Expanded: full content */}
				{expanded && (
					<>
						<MarkdownRenderer
							content={textPart.content}
							className="prose-invert [&_a]:text-primary-foreground [&_a]:opacity-90 [&_blockquote]:border-primary-foreground/30 [&_code]:bg-primary-foreground/20"
						/>
						{/* Trigger to collapse */}
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							className="mt-2 flex w-full items-center justify-center gap-1.5 py-1 text-[0.625rem] uppercase tracking-wide text-primary-foreground/70 transition-colors hover:text-primary-foreground"
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