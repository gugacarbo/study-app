import type { ComponentProps, ReactNode } from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AiModelPublic } from "@/db/queries/types";
import { groupModelsByProvider } from "@/features/ai/lib/group-models-by-provider";

type ModelSelectContentProps = {
	models: AiModelPublic[];
	leadingItems?: ReactNode;
};

export function ModelSelectGroupedItems({
	models,
	leadingItems,
}: ModelSelectContentProps) {
	const groups = groupModelsByProvider(models);

	return (
		<>
			{leadingItems}
			{groups.map((group) => (
				<SelectGroup key={group.providerId}>
					<SelectLabel>{group.providerName}</SelectLabel>
					{group.models.map((model) => (
						<SelectItem key={model.id} value={String(model.id)}>
							{model.displayName}
						</SelectItem>
					))}
				</SelectGroup>
			))}
		</>
	);
}

type ModelSelectProps = {
	models: AiModelPublic[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	emptyPlaceholder?: string;
	disabled?: boolean;
	leadingItems?: ReactNode;
	triggerSize?: ComponentProps<typeof SelectTrigger>["size"];
	triggerClassName?: string;
	contentAlign?: ComponentProps<typeof SelectContent>["align"];
	contentSide?: ComponentProps<typeof SelectContent>["side"];
	ariaLabel?: string;
};

export function ModelSelect({
	models,
	value,
	onValueChange,
	placeholder = "Select model",
	emptyPlaceholder = "No models available",
	disabled,
	leadingItems,
	triggerSize = "default",
	triggerClassName,
	contentAlign,
	contentSide,
	ariaLabel = "Select model",
}: ModelSelectProps) {
	const hasModels = models.length > 0;

	return (
		<Select
			value={value}
			disabled={disabled ?? !hasModels}
			onValueChange={onValueChange}
		>
			<SelectTrigger
				size={triggerSize}
				className={triggerClassName}
				aria-label={ariaLabel}
			>
				<SelectValue placeholder={hasModels ? placeholder : emptyPlaceholder} />
			</SelectTrigger>
			<SelectContent align={contentAlign} side={contentSide}>
				<ModelSelectGroupedItems
					models={models}
					leadingItems={leadingItems}
				/>
			</SelectContent>
		</Select>
	);
}
