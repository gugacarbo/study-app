import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	type ModelFormValues,
	modelFormSchema,
} from "@/features/admin/schemas/model";

type ModelFormProps = {
	defaultValues?: Partial<ModelFormValues>;
	submitLabel: string;
	isSubmitting?: boolean;
	onSubmit: (values: ModelFormValues) => void;
	onCancel?: () => void;
};

export function ModelForm({
	defaultValues,
	submitLabel,
	isSubmitting,
	onSubmit,
	onCancel,
}: ModelFormProps) {
	const form = useForm<ModelFormValues>({
		resolver: zodResolver(modelFormSchema),
		defaultValues: {
			modelId: "",
			displayName: "",
			enabled: true,
			...defaultValues,
		},
	});

	return (
		<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="model-id">Model ID</FieldLabel>
					<FieldContent>
						<Input id="model-id" {...form.register("modelId")} />
						<FieldError errors={[form.formState.errors.modelId]} />
					</FieldContent>
				</Field>
				<Field>
					<FieldLabel htmlFor="model-display-name">Nome</FieldLabel>
					<FieldContent>
						<Input id="model-display-name" {...form.register("displayName")} />
						<FieldError errors={[form.formState.errors.displayName]} />
					</FieldContent>
				</Field>
				<Field orientation="horizontal">
					<FieldLabel htmlFor="model-enabled">Habilitado</FieldLabel>
					<Controller
						control={form.control}
						name="enabled"
						render={({ field }) => (
							<Switch
								id="model-enabled"
								checked={field.value}
								onCheckedChange={field.onChange}
							/>
						)}
					/>
				</Field>
			</FieldGroup>
			<div className="flex justify-end gap-2">
				{onCancel ? (
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancelar
					</Button>
				) : null}
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Salvando…" : submitLabel}
				</Button>
			</div>
		</form>
	);
}
