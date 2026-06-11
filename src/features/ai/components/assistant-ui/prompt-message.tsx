"use client";

import { MessagePrimitive, useScrollLock } from "@assistant-ui/react";
import { BotIcon, ChevronDownIcon, UserRoundIcon } from "lucide-react";
import { type FC, useCallback, useRef, useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownText } from "@/features/ai/components/assistant-ui/markdown-text";
import { cn } from "@/lib/utils";

const ANIMATION_DURATION = 200;

export type PromptMessageLabel = "System prompt" | "User prompt";

type PromptVariant = "system" | "user";

type CollapsiblePromptMessageProps = {
	label: PromptMessageLabel;
};

const PROMPT_VARIANT: Record<PromptMessageLabel, PromptVariant> = {
	"System prompt": "system",
	"User prompt": "user",
};

function PromptMessageFade({
	fadeColor,
	className,
	...props
}: React.ComponentProps<"div"> & { fadeColor: string }) {
	return (
		<div
			data-slot="prompt-message-fade"
			className={cn(
				"aui-prompt-message-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10",
				"fade-in-0 animate-in",
				"group-data-[state=open]/collapsible-content:animate-out",
				"group-data-[state=open]/collapsible-content:fade-out-0",
				"group-data-[state=open]/collapsible-content:fill-mode-forwards",
				"duration-(--animation-duration)",
				className,
			)}
			style={{
				backgroundImage: `linear-gradient(to top, ${fadeColor}, transparent)`,
			}}
			{...props}
		/>
	);
}

export const CollapsiblePromptMessage: FC<CollapsiblePromptMessageProps> = ({
	label,
}) => {
	const variant = PROMPT_VARIANT[label];
	const isUser = variant === "user";
	const collapsibleRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			lockScroll();
			setOpen(nextOpen);
		},
		[lockScroll],
	);

	const Icon = isUser ? UserRoundIcon : BotIcon;
	const fadeColor = "var(--color-background)";

	return (
		<MessagePrimitive.Root
			data-slot="aui_prompt-message-root"
			data-role={variant}
			data-variant={variant}
			className={cn(
				"fade-in slide-in-from-bottom-1 animate-in px-2 duration-150",
				isUser &&
					"grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 [&:where(>*)]:col-start-2",
			)}
		>
			<Collapsible
				ref={collapsibleRef}
				data-slot="prompt-message-root"
				data-variant={variant}
				open={open}
				onOpenChange={handleOpenChange}
				className={cn(
					"aui-prompt-message-root group/prompt-message-root mb-2 w-full",
					isUser
						? "bg-background border-border/40 max-w-[min(85%,var(--thread-max-width))] rounded-xl border px-4 py-2 shadow-sm"
						: "rounded-lg border border-dashed border-border/50 bg-background/50 px-3 py-2",
				)}
				style={
					{
						"--animation-duration": `${ANIMATION_DURATION}ms`,
					} as React.CSSProperties
				}
			>
				<CollapsibleTrigger
					data-slot="prompt-message-trigger"
					className={cn(
						"aui-prompt-message-trigger group/trigger flex w-full items-center gap-2 text-left text-xs font-medium transition-colors",
						isUser
							? "text-foreground/80 hover:text-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<ChevronDownIcon
						data-slot="prompt-message-trigger-chevron"
						className={cn(
							"aui-prompt-message-trigger-chevron size-3.5 shrink-0",
							"transition-transform duration-(--animation-duration) ease-out",
							"group-data-[state=closed]/trigger:-rotate-90",
							"group-data-[state=open]/trigger:rotate-0",
						)}
					/>
					<Icon
						data-slot="prompt-message-trigger-icon"
						className={cn(
							"size-3.5 shrink-0",
							isUser ? "text-foreground/70" : "text-muted-foreground",
						)}
					/>
					<span>{label}</span>
				</CollapsibleTrigger>
				<CollapsibleContent
					forceMount
					data-slot="prompt-message-content"
					className={cn(
						"aui-prompt-message-content group/collapsible-content relative overflow-hidden text-sm leading-relaxed outline-none",
						isUser ? "text-foreground" : "text-foreground/90",
						"ease-out transition-[max-height] duration-(--animation-duration)",
						"data-[state=closed]:max-h-18",
						"data-[state=open]:max-h-[min(200vh,5000px)]",
					)}
				>
					<div className="aui-prompt-message-text pt-2 wrap-break-word">
						<MessagePrimitive.Parts
							components={{
								Text: MarkdownText,
							}}
						/>
					</div>
					<PromptMessageFade fadeColor={fadeColor} />
				</CollapsibleContent>
			</Collapsible>
		</MessagePrimitive.Root>
	);
};
