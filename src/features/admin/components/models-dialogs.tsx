import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ModelForm } from "@/features/admin/components/model-form";
import type { ModelRow } from "@/features/admin/components/models-table";
import type { ModelFormValues } from "@/features/admin/schemas/model";

export function ModelDialog({
	open,
	mode,
	model,
	busy,
	onClose,
	onSubmit,
	onTest,
}: {
	open: boolean;
	mode: "create" | "edit";
	model: ModelRow | null;
	busy: boolean;
	onClose: () => void;
	onSubmit: (values: ModelFormValues) => void;
	onTest?: (input: {
		id: string;
		modelId?: string;
	}) => Promise<{ ok: boolean; error?: string }>;
}) {
	const [testResult, setTestResult] = useState<string | null>(null);
	const [testing, setTesting] = useState(false);

	useEffect(() => {
		if (!open) {
			setTestResult(null);
			setTesting(false);
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
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
								}
							: undefined
					}
					submitLabel={mode === "create" ? "Criar" : "Salvar"}
					isSubmitting={busy}
					isTesting={testing}
					testResult={testResult}
					onCancel={onClose}
					onTest={
						mode === "edit" && model && onTest
							? async (modelId) => {
									setTesting(true);
									setTestResult(null);
									try {
										const result = await onTest({ id: model.id, modelId });
										setTestResult(
											result.ok
												? "Modelo respondeu com sucesso"
												: `Falha: ${result.error ?? "desconhecida"}`,
										);
									} catch (cause) {
										setTestResult(
											cause instanceof Error
												? cause.message
												: "Falha ao testar modelo",
										);
									} finally {
										setTesting(false);
									}
								}
							: undefined
					}
					onSubmit={onSubmit}
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
