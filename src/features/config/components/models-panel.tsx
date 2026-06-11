import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
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
import {
	THINKING_EFFORT_LEVELS,
	type ThinkingEffortLevel,
} from "@/lib/validation";
import { backgroundProcessStore } from "@/features/background-processes";
import { getModelTestProcessForModel } from "@/features/config/lib/model-test-process";
import { ModelConnectionTestBadge } from "./model-connection-test-badge";
import { useConnectionTestDialog } from "./connection-test-dialog-provider";
import { ProviderDialog } from "./provider-dialog";

type ModelFormState = {
	id?: number;
	providerId: string;
	modelId: string;
	displayName: string;
	contextWindow: string;
	maxOutputTokens: string;
	inputCostPerMillion: string;
	outputCostPerMillion: string;
	thinkingEffortLevels: ThinkingEffortLevel[];
	defaultThinkingEffort: ThinkingEffortLevel | null;
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
	thinkingEffortLevels: [],
	defaultThinkingEffort: null,
	enabled: true,
});

function formatEffortLabel(level: ThinkingEffortLevel): string {
	return level.charAt(0).toUpperCase() + level.slice(1);
}

function toggleThinkingEffortLevel(
	current: ThinkingEffortLevel[],
	level: ThinkingEffortLevel,
): ThinkingEffortLevel[] {
	if (current.includes(level)) {
		return current.filter((item) => item !== level);
	}

	return THINKING_EFFORT_LEVELS.filter(
		(item) => current.includes(item) || item === level,
	);
}

function resolveDefaultThinkingEffort(
	levels: ThinkingEffortLevel[],
	current: ThinkingEffortLevel | null,
): ThinkingEffortLevel | null {
	if (levels.length === 0) return null;
	if (current && levels.includes(current)) return current;
	return levels[0] ?? null;
}

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
	const { openDialog, startTest, startBenchmark } = useConnectionTestDialog();
	const { processes } = useStore(backgroundProcessStore);
	const [filterProviderId, setFilterProviderId] = useState<string>("all");
	const [providerFilterOpen, setProviderFilterOpen] = useState(false);
	const [providerDialogOpen, setProviderDialogOpen] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
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

	const resetDialog = () => {
		setDialogOpen(false);
		setForm(emptyForm(filterProviderId === "all" ? "" : filterProviderId));
	};

	const openCreateDialog = () => {
		setForm(emptyForm(filterProviderId === "all" ? "" : filterProviderId));
		setMessage("");
		setDialogOpen(true);
	};

	const openEditDialog = (model: (typeof models)[number]) => {
		setForm({
			id: model.id,
			providerId: String(model.providerId),
			modelId: model.modelId,
			displayName: model.displayName,
			contextWindow: String(model.contextWindow ?? ""),
			maxOutputTokens: String(model.maxOutputTokens ?? ""),
			inputCostPerMillion: String(model.inputCostPerMillion ?? 0),
			outputCostPerMillion: String(model.outputCostPerMillion ?? 0),
			thinkingEffortLevels: model.thinkingEffortLevels,
			defaultThinkingEffort: model.defaultThinkingEffort,
			enabled: model.enabled,
		});
		setMessage("");
		setDialogOpen(true);
	};

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
				thinkingEffortLevels: form.thinkingEffortLevels,
				defaultThinkingEffort: form.defaultThinkingEffort,
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
			resetDialog();
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
		<>
			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-3">
					<CardTitle>Models</CardTitle>
					<div className="flex items-center gap-2">
						<Select
							value={filterProviderId}
							open={providerFilterOpen}
							onOpenChange={setProviderFilterOpen}
							onValueChange={setFilterProviderId}
						>
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
								<SelectSeparator />
								<div className="p-1">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 w-full justify-start px-2 text-xs"
										onPointerDown={(event) => {
											event.preventDefault();
											setProviderFilterOpen(false);
											setProviderDialogOpen(true);
										}}
									>
										<Plus className="size-3.5" />
										Add provider
									</Button>
								</div>
							</SelectContent>
						</Select>
						<Button type="button" size="sm" onClick={openCreateDialog}>
							<Plus className="size-3.5" />
							Add model
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{message && !dialogOpen ? (
						<p className="text-xs text-muted-foreground">{message}</p>
					) : null}
					{models.length === 0 ? (
						<p className="text-sm text-muted-foreground">No models yet.</p>
					) : (
						models.map((model) => {
							const testSelection = getModelTestProcessForModel(
								model.id,
								processes,
							);
							const process = testSelection?.process ?? null;
							const testActive =
								process != null &&
								(process.status === "queued" || process.status === "running");
							const hasCompletedProcess =
								process != null &&
								(process.status === "success" ||
									process.status === "error" ||
									process.status === "canceled");

							return (
								<div
									key={model.id}
									className="flex items-start justify-between gap-3 rounded-md border p-3"
								>
									<div className="min-w-0 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium">{model.displayName}</p>
											<ModelConnectionTestBadge
												modelId={model.id}
												onViewTest={() => openDialog(model.id)}
											/>
										</div>
										<p className="text-xs text-muted-foreground">
											{model.providerName} · {model.modelId}
										</p>
										<p className="text-xs text-muted-foreground">
											Context: {model.contextWindow ?? "—"} · Input: $
											{model.inputCostPerMillion ?? 0}/M · Output: $
											{model.outputCostPerMillion ?? 0}/M
											{model.thinkingEffortLevels.length > 0
												? ` · Thinking: ${model.defaultThinkingEffort ?? "—"} (${model.thinkingEffortLevels.join(", ")})`
												: ""}
										</p>
									</div>
									<div className="flex shrink-0 gap-2">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button type="button" variant="outline" size="sm">
													{testActive
														? "Testing..."
														: hasCompletedProcess
															? "View test"
															: "Test"}
													<ChevronDown className="size-3.5 opacity-60" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{hasCompletedProcess || testActive ? (
													<DropdownMenuItem
														onClick={() => openDialog(model.id)}
													>
														View progress
													</DropdownMenuItem>
												) : null}
												<DropdownMenuItem
													onClick={() =>
														startTest(model.id, {
															modelDisplayName: model.displayName,
															providerName: model.providerName,
														})
													}
												>
													Quick test
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														startBenchmark(model.id, {
															modelDisplayName: model.displayName,
															providerName: model.providerName,
														})
													}
												>
													Benchmark
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => openEditDialog(model)}
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
							);
						})
					)}
				</CardContent>
			</Card>

			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open) resetDialog();
					else setDialogOpen(true);
				}}
			>
				<DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-xl">
					<DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 space-y-0 border-b pb-4">
						<DialogTitle>{form.id ? "Edit model" : "Add model"}</DialogTitle>
						<div className="flex items-center gap-2 pr-8">
							<Label
								htmlFor="model-enabled"
								className="text-muted-foreground font-normal"
							>
								Enabled
							</Label>
							<Switch
								id="model-enabled"
								checked={form.enabled}
								onCheckedChange={(enabled) =>
									setForm((current) => ({ ...current, enabled }))
								}
							/>
						</div>
					</DialogHeader>

					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
						<div className="space-y-1.5">
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
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
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
							<div className="space-y-1.5">
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
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
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
							<div className="space-y-1.5">
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
						<div className="space-y-2 rounded-md border border-border/60 p-3">
							<div className="space-y-1">
								<Label>Thinking effort levels</Label>
								<p className="text-[0.6875rem] text-muted-foreground">
									Select which effort levels this model supports.
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								{THINKING_EFFORT_LEVELS.map((level) => {
									const selected = form.thinkingEffortLevels.includes(level);
									return (
										<Button
											key={level}
											type="button"
											size="sm"
											variant={selected ? "default" : "outline"}
											onClick={() =>
												setForm((current) => {
													const thinkingEffortLevels = toggleThinkingEffortLevel(
														current.thinkingEffortLevels,
														level,
													);
													return {
														...current,
														thinkingEffortLevels,
														defaultThinkingEffort: resolveDefaultThinkingEffort(
															thinkingEffortLevels,
															current.defaultThinkingEffort,
														),
													};
												})
											}
										>
											{formatEffortLabel(level)}
										</Button>
									);
								})}
							</div>
							{form.thinkingEffortLevels.length > 0 ? (
								<div className="space-y-1.5">
									<Label htmlFor="default-thinking-effort">
										Default thinking effort
									</Label>
									<Select
										value={form.defaultThinkingEffort ?? undefined}
										onValueChange={(value) =>
											setForm((current) => ({
												...current,
												defaultThinkingEffort: value as ThinkingEffortLevel,
											}))
										}
									>
										<SelectTrigger id="default-thinking-effort">
											<SelectValue placeholder="Select default" />
										</SelectTrigger>
										<SelectContent>
											{form.thinkingEffortLevels.map((level) => (
												<SelectItem key={level} value={level}>
													{formatEffortLabel(level)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							) : null}
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
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
							<div className="space-y-1.5">
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
					</div>

					<DialogFooter className="shrink-0 border-t pt-4 sm:justify-between">
						{message ? (
							<p className="text-xs text-muted-foreground">{message}</p>
						) : (
							<span />
						)}
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={resetDialog}>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={() => saveMutation.mutate()}
								disabled={saveMutation.isPending}
							>
								{saveMutation.isPending ? "Saving..." : "Save model"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ProviderDialog
				open={providerDialogOpen}
				onOpenChange={setProviderDialogOpen}
			/>
		</>
	);
}
