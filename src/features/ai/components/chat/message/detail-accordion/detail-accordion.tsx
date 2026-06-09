import { Accordion as AccordionPrimitive } from "radix-ui";
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
	/** Controlled open state – when set, overrides defaultOpen. */
	open?: boolean;
	/** Called when the user toggles the accordion. */
	onOpenChange?: (open: boolean) => void;
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
	open,
	onOpenChange,
	isLoading = false,
	className,
	children,
}: DetailAccordionProps) {
	const contentClassName = "flex flex-col gap-4 px-0 pt-1 pb-2 [&_p]:mb-0";
	const isControlled = open !== undefined;

	return (
		<AccordionPrimitive.Root
			type="single"
			collapsible
			{...(isControlled
				? {
						value: open ? value : undefined,
						onValueChange: (nextValue: string) =>
							onOpenChange?.(nextValue === value),
					}
				: { defaultValue: defaultOpen ? value : undefined })}
			className={className}
		>
			<AccordionPrimitive.AccordionItem value={value} className="border-b-0">
				<DetailTrigger label={label} tone={tone} isLoading={isLoading} />
				<AccordionPrimitive.Content className="overflow-hidden px-0 pt-1 pb-2 text-xs/relaxed data-open:animate-accordion-down data-closed:animate-accordion-up">
					<div className={contentClassName}>{children}</div>
				</AccordionPrimitive.Content>
			</AccordionPrimitive.AccordionItem>
		</AccordionPrimitive.Root>
	);
}
