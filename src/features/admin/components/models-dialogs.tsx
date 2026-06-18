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
}: {
	open: boolean;
	mode: "create" | "edit";
	model: ModelRow | null;
	busy: boolean;
	onClose: () => void;
	onSubmit: (values: ModelFormValues) => void;
}) {
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
					onCancel={onClose}
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
