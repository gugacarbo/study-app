import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	type ModelFormValues,
	modelFormSchema,
} from "@/features/admin/schemas/model";
import { PROBE_DEFAULT_TIMEOUT_MS } from "@/functions/admin/probe-model-core";

type ModelFormProps = {
	defaultValues?: Partial<ModelFormValues>;
	submitLabel: string;
	isSubmitting?: boolean;
	isTesting?: boolean;
	onSubmit: (values: ModelFormValues) => void;
	onCancel?: () => void;
	onTest?: (input: { modelId: string; timeoutMs: number }) => void;
};

export function ModelForm({
	defaultValues,
	submitLabel,
	isSubmitting,
	isTesting,
	onSubmit,
	onCancel,
	onTest,
}: ModelFormProps) {
	const form = useForm<ModelFormValues>({
		resolver: zodResolver(modelFormSchema),
		defaultValues: {
			modelId: "",
			displayName: "",
			enabled: true,
			contextWindow: null,
			maxOutputTokens: null,
			inputCostPerMillion: null,
			outputCostPerMillion: null,
			thinkingEffortLevels: null,
			defaultThinkingEffort: null,
			thinkingEnabled: null,
			thinkingParamName: null,
			metadata: null,
			requestParams: null,
			...defaultValues,
		},
	});
	const [testTimeoutSeconds, setTestTimeoutSeconds] = useState(
		PROBE_DEFAULT_TIMEOUT_MS / 1000,
	);

	return (
		<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
			<fieldset className="rounded-lg border p-4">
				<legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Identidade
				</legend>
				<div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
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
							<Input
								id="model-display-name"
								{...form.register("displayName")}
							/>
							<FieldError errors={[form.formState.errors.displayName]} />
						</FieldContent>
					</Field>
					<Field
						orientation="horizontal"
						className="items-center self-end pb-2"
					>
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
				</div>
			</fieldset>

			<fieldset className="rounded-lg border p-4">
				<legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Capacidade e custos
				</legend>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="context-window">
							Context window (tokens)
						</FieldLabel>
						<FieldContent>
							<Input
								id="context-window"
								type="number"
								{...form.register("contextWindow", {
									setValueAs: (v) => (v === "" ? null : Number(v)),
								})}
							/>
							<FieldError errors={[form.formState.errors.contextWindow]} />
						</FieldContent>
					</Field>
					<Field>
						<FieldLabel htmlFor="max-output-tokens">
							Máximo de tokens de saída
						</FieldLabel>
						<FieldContent>
							<Input
								id="max-output-tokens"
								type="number"
								{...form.register("maxOutputTokens", {
									setValueAs: (v) => (v === "" ? null : Number(v)),
								})}
							/>
							<FieldError errors={[form.formState.errors.maxOutputTokens]} />
						</FieldContent>
					</Field>
					<Field>
						<FieldLabel htmlFor="input-cost">
							Custo de entrada / 1M tokens
						</FieldLabel>
						<FieldContent>
							<Input
								id="input-cost"
								type="number"
								step="any"
								{...form.register("inputCostPerMillion", {
									setValueAs: (v) => (v === "" ? null : Number(v)),
								})}
							/>
							<FieldError
								errors={[form.formState.errors.inputCostPerMillion]}
							/>
						</FieldContent>
					</Field>
					<Field>
						<FieldLabel htmlFor="output-cost">
							Custo de saída / 1M tokens
						</FieldLabel>
						<FieldContent>
							<Input
								id="output-cost"
								type="number"
								step="any"
								{...form.register("outputCostPerMillion", {
									setValueAs: (v) => (v === "" ? null : Number(v)),
								})}
							/>
							<FieldError
								errors={[form.formState.errors.outputCostPerMillion]}
							/>
						</FieldContent>
					</Field>
				</div>
			</fieldset>

			<fieldset className="rounded-lg border p-4">
				<legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Thinking
				</legend>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field orientation="horizontal" className="items-center sm:col-span-2">
						<FieldLabel htmlFor="thinking-enabled">
							Habilitar thinking
						</FieldLabel>
						<Controller
							control={form.control}
							name="thinkingEnabled"
							render={({ field }) => (
								<Switch
									id="thinking-enabled"
									checked={!!field.value}
									onCheckedChange={(v) => field.onChange(v || null)}
								/>
							)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="thinking-param-name">
							Nome do parâmetro
						</FieldLabel>
						<FieldContent>
							<Input
								id="thinking-param-name"
								placeholder="effort"
								{...form.register("thinkingParamName")}
							/>
							<FieldError
								errors={[form.formState.errors.thinkingParamName]}
							/>
						</FieldContent>
					</Field>
					<Field>
						<FieldLabel htmlFor="thinking-effort-levels">
							Níveis de esforço
						</FieldLabel>
						<FieldContent>
							<Input
								id="thinking-effort-levels"
								placeholder="low, medium, high"
								{...form.register("thinkingEffortLevels")}
							/>
							<FieldError
								errors={[form.formState.errors.thinkingEffortLevels]}
							/>
						</FieldContent>
					</Field>
					<Field className="sm:col-span-2">
						<FieldLabel htmlFor="default-thinking-effort">
							Esforço padrão
						</FieldLabel>
						<FieldContent>
							<Input
								id="default-thinking-effort"
								placeholder="medium"
								{...form.register("defaultThinkingEffort")}
							/>
							<FieldError
								errors={[form.formState.errors.defaultThinkingEffort]}
							/>
						</FieldContent>
					</Field>
				</div>
			</fieldset>

			<fieldset className="rounded-lg border p-4">
				<legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Avançado
				</legend>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="request-params">
							Parâmetros da requisição (JSON)
						</FieldLabel>
						<FieldContent>
							<Textarea
								id="request-params"
								rows={4}
								placeholder='{"stop": ["\n"], "temperature": 0.7}'
								{...form.register("requestParams")}
							/>
							<FieldError errors={[form.formState.errors.requestParams]} />
						</FieldContent>
					</Field>
					<Field>
						<FieldLabel htmlFor="metadata">Metadados (JSON)</FieldLabel>
						<FieldContent>
							<Textarea
								id="metadata"
								rows={4}
								{...form.register("metadata")}
							/>
							<FieldError errors={[form.formState.errors.metadata]} />
						</FieldContent>
					</Field>
				</div>
			</fieldset>

			<div className="flex items-center justify-between gap-2 pt-2">
				{onTest ? (
					<div className="flex items-end gap-2">
						<Field>
							<FieldLabel htmlFor="test-timeout-seconds">
								Timeout do teste (s)
							</FieldLabel>
							<FieldContent>
								<Input
									id="test-timeout-seconds"
									type="number"
									min={1}
									step={1}
									value={testTimeoutSeconds}
									onChange={(event) => {
										const value = Number(event.target.value);
										setTestTimeoutSeconds(
											Number.isFinite(value) && value > 0 ? value : 1,
										);
									}}
									className="w-32"
								/>
							</FieldContent>
						</Field>
						<Button
							type="button"
							variant="outline"
							disabled={isTesting || isSubmitting}
							onClick={() =>
								onTest({
									modelId: form.getValues("modelId"),
									timeoutMs: testTimeoutSeconds * 1000,
								})
							}
						>
							{isTesting ? "Testando…" : "Testar"}
						</Button>
					</div>
				) : (
					<span />
				)}
				<div className="flex gap-2">
					{onCancel ? (
						<Button type="button" variant="outline" onClick={onCancel}>
							Cancelar
						</Button>
					) : null}
					<Button type="submit" disabled={isSubmitting || isTesting}>
						{isSubmitting ? "Salvando…" : submitLabel}
					</Button>
				</div>
			</div>
		</form>
	);
}
