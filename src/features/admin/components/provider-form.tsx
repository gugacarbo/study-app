import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	type CreateProviderFormValues,
	createProviderFormSchema,
	type EditProviderFormValues,
	editProviderFormSchema,
} from "@/features/admin/schemas/provider";

type ProviderFormProps = {
	mode: "create" | "edit";
	apiKeyMasked?: string;
	hasApiKey?: boolean;
	defaultValues?: Partial<EditProviderFormValues>;
	submitLabel: string;
	isSubmitting?: boolean;
	onSubmit: (values: CreateProviderFormValues | EditProviderFormValues) => void;
	onCancel?: () => void;
};

export function ProviderForm({
	mode,
	apiKeyMasked,
	hasApiKey,
	defaultValues,
	submitLabel,
	isSubmitting,
	onSubmit,
	onCancel,
}: ProviderFormProps) {
	const schema =
		mode === "create" ? createProviderFormSchema : editProviderFormSchema;
	const form = useForm<CreateProviderFormValues | EditProviderFormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: "",
			baseUrl: "",
			apiKey: "",
			enabled: true,
			...defaultValues,
		},
	});

	useEffect(() => {
		form.reset({
			name: defaultValues?.name ?? "",
			baseUrl: defaultValues?.baseUrl ?? "",
			apiKey: "",
			enabled: defaultValues?.enabled ?? true,
		});
	}, [defaultValues, form]);

	return (
		<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="provider-name">Nome</FieldLabel>
					<FieldContent>
						<Input id="provider-name" {...form.register("name")} />
						<FieldError errors={[form.formState.errors.name]} />
					</FieldContent>
				</Field>
				<Field>
					<FieldLabel htmlFor="provider-base-url">Base URL</FieldLabel>
					<FieldContent>
						<Input
							id="provider-base-url"
							type="url"
							placeholder="https://api.openai.com/v1"
							{...form.register("baseUrl")}
						/>
						<FieldError errors={[form.formState.errors.baseUrl]} />
					</FieldContent>
				</Field>
				<Field>
					<FieldLabel htmlFor="provider-api-key">API key</FieldLabel>
					<FieldContent>
						<Input
							id="provider-api-key"
							type="password"
							autoComplete="off"
							placeholder={
								mode === "edit" ? "Deixe vazio para manter a atual" : undefined
							}
							{...form.register("apiKey")}
						/>
						{mode === "edit" && hasApiKey ? (
							<FieldDescription>
								Atual: {apiKeyMasked ?? "••••"}
							</FieldDescription>
						) : null}
						<FieldError errors={[form.formState.errors.apiKey]} />
					</FieldContent>
				</Field>
				<Field orientation="horizontal">
					<FieldLabel htmlFor="provider-enabled">Habilitado</FieldLabel>
					<Controller
						control={form.control}
						name="enabled"
						render={({ field }) => (
							<Switch
								id="provider-enabled"
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
