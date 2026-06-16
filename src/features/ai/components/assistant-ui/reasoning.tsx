"use client";

import {
	type ReasoningGroupComponent,
	type ReasoningMessagePartComponent,
	useAuiState,
	useScrollLock,
} from "@assistant-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import {
	createContext,
	type FC,
	memo,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownText } from "@/features/ai/components/assistant-ui/markdown-text";
import { cn } from "@/lib/utils";

const ANIMATION_DURATION = 200;

const ReasoningPreviewContext = createContext(false);

const reasoningVariants = cva("aui-reasoning-root mb-4 w-full", {
	variants: {
		variant: {
			outline: "rounded-lg border px-3 py-2",
			ghost: "",
			muted: "bg-muted/50 rounded-lg px-3 py-2",
		},
	},
	defaultVariants: {
		variant: "outline",
	},
});

type ReasoningRootProps = Omit<
	React.ComponentProps<typeof Collapsible>,
	"open" | "onOpenChange"
> &
	VariantProps<typeof reasoningVariants> & {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		defaultOpen?: boolean;
		/**
		 * Whether the reasoning is currently streaming. When provided, it
		 * supersedes `defaultOpen`: the disclosure auto-opens while streaming
		 * with a bottom-pinned live preview, auto-collapses when streaming
		 * ends, and the first manual toggle takes over permanently.
		 */
		streaming?: boolean;
	};

function ReasoningRoot({
	className,
	variant,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	defaultOpen = false,
	streaming,
	children,
	...props
}: ReasoningRootProps) {
	const collapsibleRef = useRef<HTMLDivElement>(null);
	const initialOpenRef = useRef(defaultOpen);
	const [userOpen, setUserOpen] = useState<boolean | null>(null);
	const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

	const isControlled = controlledOpen !== undefined;
	const isOpen = isControlled
		? controlledOpen
		: (userOpen ?? streaming ?? initialOpenRef.current);
	const isAutoMode = isControlled || userOpen === null;
	const isPreview = streaming === true && isOpen && isAutoMode;

	const prevStreamingRef = useRef(streaming);
	useLayoutEffect(() => {
		if (prevStreamingRef.current === streaming) return;
		prevStreamingRef.current = streaming;
		if (!isControlled && userOpen === null) lockScroll();
	}, [streaming, isControlled, userOpen, lockScroll]);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			lockScroll();
			if (!isControlled) {
				setUserOpen(open);
			}
			controlledOnOpenChange?.(open);
		},
		[lockScroll, isControlled, controlledOnOpenChange],
	);

	return (
		<Collapsible
			ref={collapsibleRef}
			data-slot="reasoning-root"
			data-variant={variant}
			open={isOpen}
			onOpenChange={handleOpenChange}
			className={cn(
				"group/reasoning-root",
				reasoningVariants({ variant, className }),
			)}
			style={
				{
					"--animation-duration": `${ANIMATION_DURATION}ms`,
				} as React.CSSProperties
			}
			{...props}
		>
			<ReasoningPreviewContext.Provider value={isPreview}>
				{children}
			</ReasoningPreviewContext.Provider>
		</Collapsible>
	);
}

function ReasoningFade({
	side = "bottom",
	className,
	...props
}: React.ComponentProps<"div"> & { side?: "top" | "bottom" }) {
	if (side === "top") {
		return (
			<div
				data-slot="reasoning-fade"
				className={cn(
					"aui-reasoning-fade pointer-events-none absolute inset-x-0 top-0 z-10 h-8",
					"bg-[linear-gradient(to_bottom,var(--color-background),transparent)]",
					"group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_bottom,hsl(var(--muted)/0.5),transparent)]",
					"fade-in-0 animate-in",
					"duration-(--animation-duration)",
					className,
				)}
				{...props}
			/>
		);
	}

	return (
		<div
			data-slot="reasoning-fade"
			className={cn(
				"aui-reasoning-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8",
				"bg-[linear-gradient(to_top,var(--color-background),transparent)]",
				"group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_top,hsl(var(--muted)/0.5),transparent)]",
				"fade-in-0 animate-in",
				"group-data-[state=open]/collapsible-content:animate-out",
				"group-data-[state=open]/collapsible-content:fade-out-0",
				"group-data-[state=open]/collapsible-content:delay-[calc(var(--animation-duration)*0.75)]",
				"group-data-[state=open]/collapsible-content:fill-mode-forwards",
				"duration-(--animation-duration)",
				"group-data-[state=open]/collapsible-content:duration-(--animation-duration)",
				className,
			)}
			{...props}
		/>
	);
}

function ReasoningTrigger({
	active,
	duration,
	className,
	...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
	active?: boolean;
	duration?: number;
}) {
	const durationText = duration ? ` (${duration}s)` : "";

	return (
		<CollapsibleTrigger
			data-slot="reasoning-trigger"
			className={cn(
				"aui-reasoning-trigger group/trigger text-muted-foreground hover:text-foreground flex max-w-[75%] items-center gap-2 py-1 text-sm transition-colors",
				className,
			)}
			{...props}
		>
			<BrainIcon
				data-slot="reasoning-trigger-icon"
				className="aui-reasoning-trigger-icon size-4 shrink-0"
			/>
			<span
				data-slot="reasoning-trigger-label"
				className="aui-reasoning-trigger-label-wrapper relative inline-block leading-none"
			>
				<span>Reasoning{durationText}</span>
				{active ? (
					<span
						aria-hidden
						data-slot="reasoning-trigger-shimmer"
						className="aui-reasoning-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
					>
						Reasoning{durationText}
					</span>
				) : null}
			</span>
			<ChevronDownIcon
				data-slot="reasoning-trigger-chevron"
				className={cn(
					"aui-reasoning-trigger-chevron mt-0.5 size-4 shrink-0",
					"transition-transform duration-(--animation-duration) ease-out",
					"group-data-[state=closed]/trigger:-rotate-90",
					"group-data-[state=open]/trigger:rotate-0",
				)}
			/>
		</CollapsibleTrigger>
	);
}

function ReasoningContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof CollapsibleContent>) {
	const isPreview = useContext(ReasoningPreviewContext);

	return (
		<CollapsibleContent
			data-slot="reasoning-content"
			className={cn(
				"aui-reasoning-content text-muted-foreground relative overflow-hidden text-sm outline-none",
				"group/collapsible-content ease-out",
				"data-[state=closed]:animate-collapsible-up",
				"data-[state=open]:animate-collapsible-down",
				"data-[state=closed]:fill-mode-forwards",
				"data-[state=closed]:pointer-events-none",
				"data-[state=open]:duration-(--animation-duration)",
				"data-[state=closed]:duration-(--animation-duration)",
				className,
			)}
			{...props}
		>
			{isPreview ? <ReasoningFade side="top" /> : null}
			{children}
			<ReasoningFade />
		</CollapsibleContent>
	);
}

function ReasoningText({
	className,
	children,
	...props
}: React.ComponentProps<"div">) {
	const isPreview = useContext(ReasoningPreviewContext);
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isPreview) return;
		const scrollEl = scrollRef.current;
		const contentEl = contentRef.current;
		if (!scrollEl || !contentEl) return;
		const pin = () => {
			scrollEl.scrollTop = scrollEl.scrollHeight;
		};
		pin();
		const observer = new ResizeObserver(pin);
		observer.observe(contentEl);
		return () => observer.disconnect();
	}, [isPreview]);

	return (
		<div
			ref={scrollRef}
			data-slot="reasoning-text"
			className={cn(
				"aui-reasoning-text relative z-0 max-h-64 overflow-y-auto ps-6 pt-2 pb-2 leading-relaxed",
				"transform-gpu transition-[transform,opacity]",
				"group-data-[state=open]/collapsible-content:animate-in",
				"group-data-[state=closed]/collapsible-content:animate-out",
				"group-data-[state=open]/collapsible-content:fade-in-0",
				"group-data-[state=closed]/collapsible-content:fade-out-0",
				"group-data-[state=open]/collapsible-content:slide-in-from-top-4",
				"group-data-[state=closed]/collapsible-content:slide-out-to-top-4",
				"group-data-[state=open]/collapsible-content:duration-(--animation-duration)",
				"group-data-[state=closed]/collapsible-content:duration-(--animation-duration)",
				className,
			)}
			{...props}
		>
			<div ref={contentRef} className="aui-reasoning-text-content space-y-4">
				{children}
			</div>
		</div>
	);
}

function CollapsibleReasoningFade({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="collapsible-reasoning-fade"
			className={cn(
				"aui-collapsible-reasoning-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10",
				"fade-in-0 animate-in",
				"group-data-[state=open]/collapsible-content:animate-out",
				"group-data-[state=open]/collapsible-content:fade-out-0",
				"group-data-[state=open]/collapsible-content:fill-mode-forwards",
				"duration-(--animation-duration)",
				className,
			)}
			style={{
				backgroundImage:
					"linear-gradient(to top, var(--color-background), transparent)",
			}}
			{...props}
		/>
	);
}

/** Agent-run surfaces: collapsed-by-default thinking, like collapsible prompts. */
export const CollapsibleReasoningGroup: FC<
	PropsWithChildren<{ active?: boolean }>
> = ({ active = false, children }) => {
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

	return (
		<Collapsible
			ref={collapsibleRef}
			data-slot="collapsible-reasoning-root"
			open={open}
			onOpenChange={handleOpenChange}
			className="aui-collapsible-reasoning-root group/collapsible-reasoning-root mb-2 w-full rounded-xl border border-border/40 bg-background px-4 py-2 shadow-sm"
			style={
				{
					"--animation-duration": `${ANIMATION_DURATION}ms`,
				} as React.CSSProperties
			}
		>
			<CollapsibleTrigger
				data-slot="collapsible-reasoning-trigger"
				className="aui-collapsible-reasoning-trigger group/trigger flex w-full items-center gap-2 text-left text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
			>
				<ChevronDownIcon
					data-slot="collapsible-reasoning-trigger-chevron"
					className={cn(
						"size-3.5 shrink-0",
						"transition-transform duration-(--animation-duration) ease-out",
						"group-data-[state=closed]/trigger:-rotate-90",
						"group-data-[state=open]/trigger:rotate-0",
					)}
				/>
				<BrainIcon
					data-slot="collapsible-reasoning-trigger-icon"
					className="size-3.5 shrink-0 text-foreground/70"
				/>
				<span
					data-slot="collapsible-reasoning-trigger-label"
					className="relative inline-block leading-none"
				>
					<span>Thinking</span>
					{active ? (
						<span
							aria-hidden
							data-slot="collapsible-reasoning-trigger-shimmer"
							className="aui-collapsible-reasoning-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
						>
							Thinking
						</span>
					) : null}
				</span>
			</CollapsibleTrigger>
			<CollapsibleContent
				forceMount
				data-slot="collapsible-reasoning-content"
				className={cn(
					"aui-collapsible-reasoning-content group/collapsible-content relative overflow-hidden text-sm leading-relaxed text-muted-foreground outline-none",
					"ease-out transition-[max-height] duration-(--animation-duration)",
					"data-[state=closed]:max-h-18",
					"data-[state=open]:max-h-[min(200vh,5000px)]",
				)}
			>
				<div className="aui-collapsible-reasoning-text space-y-4 pt-2 wrap-break-word">
					{children}
				</div>
				<CollapsibleReasoningFade />
			</CollapsibleContent>
		</Collapsible>
	);
};

const ReasoningImpl: ReasoningMessagePartComponent = () => <MarkdownText />;

const ReasoningGroupImpl: ReasoningGroupComponent = ({
	children,
	startIndex,
	endIndex,
}) => {
	const isReasoningStreaming = useAuiState((s) => {
		if (s.message.status?.type !== "running") return false;
		const lastIndex = s.message.parts.length - 1;
		if (lastIndex < 0) return false;
		const lastType = s.message.parts[lastIndex]?.type;
		if (lastType !== "reasoning") return false;
		return lastIndex >= startIndex && lastIndex <= endIndex;
	});

	return (
		<ReasoningRoot streaming={isReasoningStreaming}>
			<ReasoningTrigger active={isReasoningStreaming} />
			<ReasoningContent aria-busy={isReasoningStreaming}>
				<ReasoningText>{children}</ReasoningText>
			</ReasoningContent>
		</ReasoningRoot>
	);
};

const Reasoning = memo(
	ReasoningImpl,
) as unknown as ReasoningMessagePartComponent & {
	Root: typeof ReasoningRoot;
	Trigger: typeof ReasoningTrigger;
	Content: typeof ReasoningContent;
	Text: typeof ReasoningText;
	Fade: typeof ReasoningFade;
};

Reasoning.displayName = "Reasoning";
Reasoning.Root = ReasoningRoot;
Reasoning.Trigger = ReasoningTrigger;
Reasoning.Content = ReasoningContent;
Reasoning.Text = ReasoningText;
Reasoning.Fade = ReasoningFade;

/**
 * @deprecated This wrapper targets the legacy `components.ReasoningGroup`
 * prop on `<MessagePrimitive.Parts>`. Use `<MessagePrimitive.GroupedParts>`
 * with a `groupBy` returning `"group-reasoning"` and compose `ReasoningRoot`
 * / `ReasoningTrigger` / `ReasoningContent` / `ReasoningText` directly.
 * See `thread.tsx` for an example.
 */
const ReasoningGroup = memo(ReasoningGroupImpl);
ReasoningGroup.displayName = "ReasoningGroup";

export {
	Reasoning,
	ReasoningContent,
	ReasoningRoot,
	ReasoningText,
	ReasoningTrigger,
};
