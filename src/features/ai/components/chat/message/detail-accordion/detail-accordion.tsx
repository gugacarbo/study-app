import { Accordion as AccordionPrimitive } from "radix-ui";
import { AccordionContent } from "#/components/ui/accordion";
import type { DetailTriggerTone } from "../chat-message-utils";
import { DetailTrigger } from "./detail-accordion-trigger";

interface DetailAccordionProps {
	/** AccordionItem value – must be unique within the accordion. */
	value: string;
	/** Label shown on the trigger button. */
	label: string;
	/** Visual tone of the trigger. */
	tone?: DetailTriggerTone;
	/** Whether the accordion starts expanded. */
	defaultOpen?: boolean;
	/** Whether trigger should show loading treatment. */
	isLoading?: boolean;
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
	isLoading = false,
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
				<DetailTrigger label={label} tone={tone} isLoading={isLoading} />
				<AccordionContent className="px-0 py-1 pb-2">
					{children}
				</AccordionContent>
			</AccordionPrimitive.AccordionItem>
		</AccordionPrimitive.Root>
	);
}
