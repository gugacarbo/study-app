import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ModelForm } from "@/features/admin/components/model-form";
import { ModelTestStreamDialog } from "@/features/admin/components/model-test-stream-dialog";
import type { ModelRow } from "@/features/admin/components/models-table";
import { useModelProbeStream } from "@/features/admin/hooks/use-model-probe-stream";
import type { ModelFormValues } from "@/features/admin/schemas/model";
import { PROBE_MAX_OUTPUT_TOKENS } from "@/functions/admin/probe-model-core";

export function ModelDialog({
	open,
	mode,
	model,
	providerName,
	providerBaseUrl,
	busy,
	onClose,
	onSubmit,
}: {
	open: boolean;
	mode: "create" | "edit";
	model: ModelRow | null;
	providerName?: string;
	providerBaseUrl?: string;
	busy: boolean;
	onClose: () => void;
	onSubmit: (values: ModelFormValues) => void;
}) {
	const [testOpen, setTestOpen] = useState(false);
	const {
		state: stream,
		start: startProbe,
		reset: resetProbe,
	} = useModelProbeStream();

	useEffect(() => {
		if (!open) {
			setTestOpen(false);
			resetProbe();
		}
	}, [open, resetProbe]);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && testOpen) return;
				if (!next) onClose();
			}}
		>
			<DialogContent
				className="w-[calc(100%-2rem)] max-w-6xl sm:max-w-6xl lg:max-w-6xl"
				onInteractOutside={(event) => {
					if (testOpen) event.preventDefault();
				}}
				onPointerDownOutside={(event) => {
					if (testOpen) event.preventDefault();
				}}
				onFocusOutside={(event) => {
					if (testOpen) event.preventDefault();
				}}
			>
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "Novo modelo" : "Editar modelo"}
					</DialogTitle>
				</DialogHeader>
				<ModelForm
					defaultValues={
						model
							? {
									modelId: model.modelId,
									displayName: model.displayName,
									enabled: model.enabled,
									contextWindow: model.contextWindow,
									maxOutputTokens: model.maxOutputTokens,
									inputCostPerMillion: model.inputCostPerMillion,
									outputCostPerMillion: model.outputCostPerMillion,
									thinkingEffortLevels: model.thinkingEffortLevels,
									defaultThinkingEffort: model.defaultThinkingEffort,
									thinkingEnabled: model.thinkingEnabled,
									thinkingParamName: model.thinkingParamName,
									metadata: model.metadata,
									requestParams: model.requestParams,
								}
							: undefined
					}
					submitLabel={mode === "create" ? "Criar" : "Salvar"}
					isSubmitting={busy}
					isTesting={testOpen && stream.status === "streaming"}
					onCancel={onClose}
					onTest={
						mode === "edit" && model
							? (modelId) => {
									const testedModelId = modelId.trim() || model.modelId;
									setTestOpen(true);
									void startProbe({
										modelRowId: model.id,
										savedModelId: model.modelId,
										testedModelId,
										displayName: model.displayName,
										providerName: providerName ?? "",
										providerBaseUrl: providerBaseUrl ?? "",
										maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
									});
								}
							: undefined
					}
					onSubmit={onSubmit}
				/>
				<ModelTestStreamDialog
					open={testOpen}
					title={`Teste: ${model?.displayName ?? "modelo"}`}
					stream={stream}
					onClose={() => {
						setTestOpen(false);
						resetProbe();
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}

export function DiscoverModelsDialog({
	open,
	models,
	selected,
	busy,
	onToggle,
	onClose,
	onImport,
}: {
	open: boolean;
	models: Array<{ modelId: string; displayName: string }>;
	selected: Set<string>;
	busy: boolean;
	onToggle: (modelId: string, checked: boolean) => void;
	onClose: () => void;
	onImport: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Importar modelos</DialogTitle>
				</DialogHeader>
				<div className="max-h-64 space-y-2 overflow-y-auto">
					{models.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Nenhum modelo encontrado no provider.
						</p>
					) : (
						models.map((model) => (
							<label
								key={model.modelId}
								className="flex items-center gap-2 text-sm"
							>
								<input
									type="checkbox"
									checked={selected.has(model.modelId)}
									onChange={(e) => onToggle(model.modelId, e.target.checked)}
								/>
								<span>{model.displayName}</span>
							</label>
						))
					)}
				</div>
				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={onClose}>
						Cancelar
					</Button>
					<Button disabled={busy || selected.size === 0} onClick={onImport}>
						Importar selecionados
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
