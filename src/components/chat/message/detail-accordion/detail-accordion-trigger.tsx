import {
	ChevronDownIcon,
	ChevronUpIcon,
	CircleDot,
	LoaderCircle,
	OctagonAlert,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { ShimmerTextSpan } from "#/components/shimmer-text-span";
import { cn } from "@/lib/utils";
import type { DetailTriggerTone } from "../chat-message-utils";
import { triggerToneClass } from "../chat-message-utils";

export function DetailTrigger({
	label,
	tone = "neutral",
	isLoading = false,
	className,
}: {
	label: string;
	tone?: DetailTriggerTone;
	isLoading?: boolean;
	className?: string;
}) {
	const icon =
		tone === "success" ? (
			<ShieldCheck className="size-3 shrink-0" aria-hidden />
		) : tone === "error" ? (
			<OctagonAlert className="size-3 shrink-0" aria-hidden />
		) : tone === "progress" ? (
			<LoaderCircle
				className={cn("size-3 shrink-0", isLoading ? "animate-spin" : "")}
				aria-hidden
			/>
		) : tone === "approval" ? (
			<Sparkles className="size-3 shrink-0" aria-hidden />
		) : (
			<CircleDot className="size-3 shrink-0" aria-hidden />
		);

	const content = (
		<span className="inline-flex items-center gap-1.5 text-muted-foreground">
			{icon}
			<span>{label}</span>
		</span>
	);

	return (
		<AccordionPrimitive.Trigger
			className={cn(
				"text-xs flex items-center w-full font-medium normal-case py-1 px-0.5 focus-visible:border-0 focus-visible:ring-0 group",
				className,
			)}
			data-slot="accordion-trigger"
		>
			{isLoading ? (
				<ShimmerTextSpan shimmerColor={triggerToneClass(tone)}>
					{content}
				</ShimmerTextSpan>
			) : (
				content
			)}
			<div className="ml-auto">
				<ChevronDownIcon
					data-slot="accordion-trigger-icon"
					className="pointer-events-none size-4 text-muted-foreground shrink-0 group-aria-expanded:hidden opacity-0 group-hover:opacity-100 transition-opacity"
				/>
				<ChevronUpIcon className="pointer-events-none size-4 text-muted-foreground hidden shrink-0 group-aria-expanded:inline" />
			</div>
		</AccordionPrimitive.Trigger>
	);
}
