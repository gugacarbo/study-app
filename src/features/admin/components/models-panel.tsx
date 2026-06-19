import { useState } from "react";
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
import { ModelsPanelToolbar } from "@/features/admin/components/models-panel-toolbar";
import {
	type ModelRow,
	ModelsTable,
} from "@/features/admin/components/models-table";
import type { AdminAiConfig } from "@/features/admin/hooks/use-admin-ai-config";
import { usePanelAction } from "@/features/admin/hooks/use-panel-action";
import type { ModelFormValues } from "@/features/admin/schemas/model";

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
	const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
	const [dialog, setDialog] = useState<"create" | ModelRow | null>(null);
	const [discoverOpen, setDiscoverOpen] = useState(false);
	const [discovered, setDiscovered] = useState<
		Array<{ modelId: string; displayName: string }>
	>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const { error, busy, run } = usePanelAction();

	const providerModels = models.filter((m) => m.providerId === providerId);
	const provider = providers.find((p) => p.id === providerId);

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
				/>
			</CardContent>
			<ModelDialog
				open={dialog !== null}
				mode={dialog === "create" ? "create" : "edit"}
				model={dialog === "create" ? null : dialog}
				providerName={provider?.name}
				providerBaseUrl={provider?.baseUrl}
				busy={busy}
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
		</Card>
	);
}
