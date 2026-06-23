import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DiscoverModelsDialog,
	ModelDialog,
} from "@/features/admin/components/models-dialogs";
import { ModelTestStreamDialog } from "@/features/admin/components/model-test-stream-dialog";
import { ModelsPanelToolbar } from "@/features/admin/components/models-panel-toolbar";
import {
	type ModelRow,
	ModelsTable,
} from "@/features/admin/components/models-table";
import {
	ADMIN_AI_CONFIG_KEY,
	type AdminAiConfig,
} from "@/features/admin/hooks/use-admin-ai-config";
import { useModelProbeStream } from "@/features/admin/hooks/use-model-probe-stream";
import { usePanelAction } from "@/features/admin/hooks/use-panel-action";
import type { ModelFormValues } from "@/features/admin/schemas/model";
import {
	PROBE_DEFAULT_TIMEOUT_MS,
	PROBE_MAX_OUTPUT_TOKENS,
	PROBE_PROMPT,
} from "@/functions/admin/probe-model-core";

type ModelsPanelProps = {
	providers: AdminAiConfig["providers"];
	models: ModelRow[];
	onUpsert: (providerId: string, values: ModelFormValues) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	onDiscover: (providerId: string) => Promise<{
		models: Array<{ modelId: string; displayName: string }>;
	}>;
};

export function ModelsPanel({
	providers,
	models,
	onUpsert,
	onDelete,
	onDiscover,
}: ModelsPanelProps) {
	const queryClient = useQueryClient();
	const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
	const [dialog, setDialog] = useState<"create" | ModelRow | null>(null);
	const [discoverOpen, setDiscoverOpen] = useState(false);
	const [discovered, setDiscovered] = useState<
		Array<{ modelId: string; displayName: string }>
	>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [testModel, setTestModel] = useState<ModelRow | null>(null);
	const [testDefaults, setTestDefaults] = useState<{
		modelId: string;
		prompt: string;
		timeoutMs: number;
		reasoningEffort?: string | null;
	} | null>(null);
	const { error, busy, run } = usePanelAction();
	const { state: probeState, start: startProbe, reset: resetProbe } =
		useModelProbeStream();

	const providerModels = models.filter((m) => m.providerId === providerId);
	const provider = providers.find((p) => p.id === providerId);

	useEffect(() => {
		if (!testModel) return;
		if (probeState.status !== "done" && probeState.status !== "error") return;
		void queryClient.invalidateQueries({ queryKey: ADMIN_AI_CONFIG_KEY });
	}, [probeState.status, testModel, queryClient]);

	return (
		<Card>
			<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<CardTitle>Modelos</CardTitle>
					<CardDescription>Catálogo por provider.</CardDescription>
				</div>
				<ModelsPanelToolbar
					providers={providers}
					providerId={providerId}
					providerEnabled={provider?.enabled ?? false}
					busy={busy}
					onProviderChange={setProviderId}
					onCreate={() => setDialog("create")}
					onDiscover={() =>
						run(async () => {
							const result = await onDiscover(providerId);
							setDiscovered(result.models);
							setSelected(new Set(result.models.map((m) => m.modelId)));
							setDiscoverOpen(true);
						})
					}
				/>
			</CardHeader>
			<CardContent className="space-y-4">
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
				<ModelsTable
					models={providerModels}
					busy={busy}
					onEdit={setDialog}
					onDelete={(model) =>
						run(async () => {
							if (!window.confirm(`Excluir modelo "${model.displayName}"?`)) {
								return;
							}
							await onDelete(model.id);
						})
					}
					onTest={(model) => {
						resetProbe();
						setTestModel(model);
						setTestDefaults({
							modelId: model.modelId,
							prompt: PROBE_PROMPT,
							timeoutMs: PROBE_DEFAULT_TIMEOUT_MS,
							reasoningEffort: model.defaultThinkingEffort,
						});
					}}
				/>
			</CardContent>
			<ModelDialog
				open={dialog !== null}
				mode={dialog === "create" ? "create" : "edit"}
				model={dialog === "create" ? null : dialog}
				providerName={provider?.name}
				providerBaseUrl={provider?.baseUrl}
				busy={busy}
				onTestResult={() =>
					queryClient.invalidateQueries({ queryKey: ADMIN_AI_CONFIG_KEY })
				}
				onClose={() => setDialog(null)}
				onSubmit={(values) =>
					run(async () => {
						await onUpsert(providerId, values);
						setDialog(null);
					})
				}
			/>
			<DiscoverModelsDialog
				open={discoverOpen}
				models={discovered}
				selected={selected}
				busy={busy}
				onToggle={(modelId, checked) =>
					setSelected((prev) => {
						const next = new Set(prev);
						if (checked) next.add(modelId);
						else next.delete(modelId);
						return next;
					})
				}
				onClose={() => setDiscoverOpen(false)}
				onImport={() =>
					run(async () => {
						for (const item of discovered) {
							if (!selected.has(item.modelId)) continue;
							await onUpsert(providerId, {
								modelId: item.modelId,
								displayName: item.displayName,
								enabled: true,
							});
						}
						setDiscoverOpen(false);
					})
				}
			/>
			<ModelTestStreamDialog
				open={testModel !== null}
				title={`Teste: ${testModel?.displayName ?? "modelo"}`}
				stream={probeState}
				defaultConfig={
					testDefaults ?? {
						modelId: testModel?.modelId ?? "",
						prompt: PROBE_PROMPT,
						timeoutMs: PROBE_DEFAULT_TIMEOUT_MS,
						reasoningEffort: testModel?.defaultThinkingEffort ?? null,
					}
				}
				onStart={(config) => {
					if (!testModel) return;
					void startProbe({
						modelRowId: testModel.id,
						savedModelId: testModel.modelId,
						testedModelId: config.modelId,
						displayName: testModel.displayName,
						providerName: provider?.name ?? "",
						providerBaseUrl: provider?.baseUrl ?? "",
						maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
						timeoutMs: config.timeoutMs,
						prompt: config.prompt,
						reasoningEffort: config.reasoningEffort,
					});
				}}
				onClose={() => {
					setTestModel(null);
					setTestDefaults(null);
					resetProbe();
				}}
			/>
		</Card>
	);
}
