import type { UIMessage } from "@tanstack/ai-client";
import { ChevronDownIcon, UserIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface UserMessageProps {
	message: UIMessage;
}

const COLLAPSED_HEIGHT_PX = 96;

const USER_BUBBLE_CLASS =
	"relative min-w-1/2 max-w-3/5 overflow-hidden rounded-lg bg-primary px-4 pt-2.5 pb-1 text-sm leading-relaxed text-primary-foreground md:min-w-2/5";

const USER_PROMPT_TEXT_CLASS = "whitespace-pre-wrap break-words";

const TRIGGER_CLASS =
	"flex w-full items-center justify-center gap-1.5 py-1 text-[0.625rem] font-medium uppercase tracking-wide text-primary-foreground/65 transition-colors hover:text-primary-foreground focus-visible:outline-none";

export function UserMessage({ message }: UserMessageProps) {
	const [expanded, setExpanded] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);
	const [maxHeight, setMaxHeight] = useState(COLLAPSED_HEIGHT_PX);

	const textPart = message.parts.find((p) => p.type === "text");
	const content = textPart?.content ?? "";

	useLayoutEffect(() => {
		const el = contentRef.current;
		if (!el || content.length === 0) return;

		const fullHeight = el.scrollHeight;
		setMaxHeight(expanded ? fullHeight : COLLAPSED_HEIGHT_PX);
	}, [expanded, content]);

	if (!textPart) return null;

	return (
		<div className="flex flex-col items-end gap-1.5">
			<div className="flex items-center gap-1.5 px-1">
				<UserIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
				<span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
					User Prompt
				</span>
			</div>

			<div className={USER_BUBBLE_CLASS}>
				<div
					className="overflow-hidden transition-[max-height] duration-200 ease-out"
					style={{ maxHeight }}
				>
					<div
						ref={contentRef}
						className={cn("relative", !expanded && "pb-6")}
					>
						<div className={USER_PROMPT_TEXT_CLASS}>{content}</div>

						{!expanded ? (
							<div
								className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-35% via-transparent to-primary/80"
								aria-hidden
							/>
						) : null}
					</div>
				</div>

				{!expanded ? (
					<div
						className={cn(
							"pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-10",
							"bg-linear-to-t from-primary from-40% via-primary/95 to-transparent",
						)}
						aria-hidden
					/>
				) : null}

				<button
					type="button"
					aria-expanded={expanded}
					onClick={() => setExpanded((value) => !value)}
					className={cn(
						TRIGGER_CLASS,
						!expanded && "absolute bottom-0 left-0 right-0 z-10",
						expanded && "mt-1.5",
					)}
				>
					<ChevronDownIcon
						className={cn(
							"size-3 shrink-0 transition-transform duration-200",
							expanded && "rotate-180",
						)}
						aria-hidden
					/>
					{expanded ? "Fechar" : "Abrir mensagem"}
				</button>
			</div>
		</div>
	);
}
