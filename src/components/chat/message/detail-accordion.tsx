import { Accordion as AccordionPrimitive } from "radix-ui";
import { DetailTrigger } from "./chat-message-detail-trigger";
import type { DetailTriggerTone } from "./chat-message-utils";

interface DetailAccordionProps {
	/** AccordionItem value – must be unique within the accordion. */
	value: string;
	/** Label shown on the trigger button. */
	label: string;
	/** Visual tone of the trigger. */
	tone?: DetailTriggerTone;
	/** Whether the accordion starts expanded. */
	defaultOpen?: boolean;
	/** Extra classes on the outer <Accordion>. */
	className?: string;
	/** Content rendered inside AccordionContent. */
	children: React.ReactNode;
}
export function DetailAccordion({
	value,
	label,
	tone = "neutral",
	defaultOpen = false,
	className,
	children,
}: DetailAccordionProps) {
	return (
		<AccordionPrimitive.Root
			type="single"
			collapsible
			defaultValue={defaultOpen ? value : undefined}
			className={className}
		>
			<AccordionPrimitive.AccordionItem value={value} className="border-b-0">
				<DetailTrigger label={label} tone={tone} />
				<AccordionPrimitive.AccordionContent className="px-2 pb-2">
					{children}
				</AccordionPrimitive.AccordionContent>
			</AccordionPrimitive.AccordionItem>
		</AccordionPrimitive.Root>
	);
}
