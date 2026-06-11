import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	createModel,
	deleteModel,
	listModels,
	updateModel,
} from "@/server-functions/ai-models";
import { listProviders } from "@/server-functions/ai-providers";

type ModelFormState = {
	id?: number;
	providerId: string;
	modelId: string;
	displayName: string;
	contextWindow: string;
	maxOutputTokens: string;
	inputCostPerMillion: string;
	outputCostPerMillion: string;
	enabled: boolean;
};

const emptyForm = (providerId = ""): ModelFormState => ({
	providerId,
	modelId: "",
	displayName: "",
	contextWindow: "128000",
	maxOutputTokens: "",
	inputCostPerMillion: "0",
	outputCostPerMillion: "0",
	enabled: true,
});

function parseOptionalInt(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseInt(trimmed, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalFloat(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

export function ModelsPanel() {
	const queryClient = useQueryClient();
	const [filterProviderId, setFilterProviderId] = useState<string>("all");
	const [form, setForm] = useState<ModelFormState>(emptyForm());
	const [message, setMessage] = useState("");

	const { data: providers = [] } = useQuery({
		queryKey: ["ai-providers"],
		queryFn: () => listProviders(),
	});

	const { data: allModels = [] } = useQuery({
		queryKey: ["ai-models"],
		queryFn: () => listModels(),
	});

	const models =
		filterProviderId === "all"
			? allModels
			: allModels.filter(
					(model) => model.providerId === Number(filterProviderId),
				);

	const saveMutation = useMutation({
		mutationFn: async () => {
			const providerId = Number(form.providerId);
			if (!providerId) throw new Error("Provider is required");

			const payload = {
				modelId: form.modelId,
				displayName: form.displayName,
				contextWindow: parseOptionalInt(form.contextWindow),
				maxOutputTokens: parseOptionalInt(form.maxOutputTokens),
				inputCostPerMillion: parseOptionalFloat(form.inputCostPerMillion),
				outputCostPerMillion: parseOptionalFloat(form.outputCostPerMillion),
				enabled: form.enabled,
			};

			if (form.id) {
				await updateModel({ data: { id: form.id, ...payload } });
				return;
			}

			await createModel({
				data: {
					providerId,
					...payload,
				},
			});
		},
		onSuccess: async () => {
			setMessage("Model saved");
			setForm(emptyForm(filterProviderId === "all" ? "" : filterProviderId));
			await queryClient.invalidateQueries({ queryKey: ["ai-models"] });
		},
		onError: (error) => {
			setMessage(error instanceof Error ? error.message : "Failed to save");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteModel({ data: { id } }),
		onSuccess: async () => {
			setMessage("Model deleted");
			await queryClient.invalidateQueries({ queryKey: ["ai-models"] });
			await queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
		},
		onError: (error) => {
			setMessage(error instanceof Error ? error.message : "Failed to delete");
		},
	});

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-3">
					<CardTitle>Models</CardTitle>
					<Select value={filterProviderId} onValueChange={setFilterProviderId}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="All providers" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All providers</SelectItem>
							{providers.map((provider) => (
								<SelectItem key={provider.id} value={String(provider.id)}>
									{provider.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardHeader>
				<CardContent className="space-y-3">
					{models.length === 0 ? (
						<p className="text-sm text-muted-foreground">No models yet.</p>
					) : (
						models.map((model) => (
							<div
								key={model.id}
								className="flex items-start justify-between gap-3 rounded-md border p-3"
							>
								<div>
									<p className="font-medium">{model.displayName}</p>
									<p className="text-xs text-muted-foreground">
										{model.providerName} · {model.modelId}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										Context: {model.contextWindow ?? "—"} · Input: $
										{model.inputCostPerMillion ?? 0}/M · Output: $
										{model.outputCostPerMillion ?? 0}/M
									</p>
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											setForm({
												id: model.id,
												providerId: String(model.providerId),
												modelId: model.modelId,
												displayName: model.displayName,
												contextWindow: String(model.contextWindow ?? ""),
												maxOutputTokens: String(model.maxOutputTokens ?? ""),
												inputCostPerMillion: String(
													model.inputCostPerMillion ?? 0,
												),
												outputCostPerMillion: String(
													model.outputCostPerMillion ?? 0,
												),
												enabled: model.enabled,
											})
										}
									>
										Edit
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={() => deleteMutation.mutate(model.id)}
									>
										Delete
									</Button>
								</div>
							</div>
						))
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{form.id ? "Edit model" : "Add model"}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label>Provider</Label>
						<Select
							value={form.providerId}
							onValueChange={(providerId) =>
								setForm((current) => ({ ...current, providerId }))
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select provider" />
							</SelectTrigger>
							<SelectContent>
								{providers.map((provider) => (
									<SelectItem key={provider.id} value={String(provider.id)}>
										{provider.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="model-id">Model ID</Label>
						<Input
							id="model-id"
							value={form.modelId}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									modelId: event.target.value,
								}))
							}
							placeholder="openai/gpt-4o-mini"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="model-display-name">Display name</Label>
						<Input
							id="model-display-name"
							value={form.displayName}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									displayName: event.target.value,
								}))
							}
							placeholder="GPT-4o Mini"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="context-window">Context window</Label>
							<Input
								id="context-window"
								value={form.contextWindow}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										contextWindow: event.target.value,
									}))
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="max-output">Max output tokens</Label>
							<Input
								id="max-output"
								value={form.maxOutputTokens}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										maxOutputTokens: event.target.value,
									}))
								}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="input-cost">Input cost / 1M USD</Label>
							<Input
								id="input-cost"
								value={form.inputCostPerMillion}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										inputCostPerMillion: event.target.value,
									}))
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="output-cost">Output cost / 1M USD</Label>
							<Input
								id="output-cost"
								value={form.outputCostPerMillion}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										outputCostPerMillion: event.target.value,
									}))
								}
							/>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Switch
							id="model-enabled"
							checked={form.enabled}
							onCheckedChange={(enabled) =>
								setForm((current) => ({ ...current, enabled }))
							}
						/>
						<Label htmlFor="model-enabled">Enabled</Label>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							onClick={() => saveMutation.mutate()}
							disabled={saveMutation.isPending}
						>
							{saveMutation.isPending ? "Saving..." : "Save model"}
						</Button>
						{form.id ? (
							<Button
								type="button"
								variant="outline"
								onClick={() => setForm(emptyForm())}
							>
								Cancel
							</Button>
						) : null}
					</div>
					{message ? (
						<p className="text-sm text-muted-foreground">{message}</p>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
