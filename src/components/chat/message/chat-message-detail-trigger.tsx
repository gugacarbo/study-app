import { Accordion as AccordionPrimitive } from "radix-ui";
import { ShimmerTextSpan } from "#/components/shimmer-text-span";
import { cn } from "@/lib/utils";
import type { DetailTriggerTone } from "./chat-message-utils";
import { triggerToneClass } from "./chat-message-utils";

export function DetailTrigger({
	label,
	tone = "neutral",
	className,
}: {
	label: string;
	tone?: DetailTriggerTone;
	className?: string;
}) {
	return (
		<AccordionPrimitive.Trigger
			className={cn(
				"text-xs font-medium normal-case py-1 px-0.5 focus-visible:border-0 focus-visible:ring-0",
				className,
			)}
		>
			<ShimmerTextSpan shimmerColor={triggerToneClass(tone)}>
				{label}
			</ShimmerTextSpan>
		</AccordionPrimitive.Trigger>
	);
}
