import { Accordion as AccordionPrimitive } from "radix-ui";
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
				"chat-thinking-part border-0 bg-transparent px-2 py-1 text-xs font-medium normal-case no-underline hover:bg-transparent hover:no-underline focus-visible:border-0 focus-visible:ring-0",
				triggerToneClass(tone),
				className,
			)}
		>
			{label}
		</AccordionPrimitive.Trigger>
	);
}
