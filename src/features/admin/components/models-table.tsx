import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AdminAiConfig } from "@/features/admin/hooks/use-admin-ai-config";

export type ModelRow = AdminAiConfig["models"][number];

type ModelsTableProps = {
	models: ModelRow[];
	busy: boolean;
	onEdit: (model: ModelRow) => void;
	onDelete: (model: ModelRow) => void;
};

export function ModelsTable({
	models,
	busy,
	onEdit,
	onDelete,
}: ModelsTableProps) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Model ID</TableHead>
					<TableHead>Nome</TableHead>
					<TableHead>Status</TableHead>
					<TableHead className="text-right">Ações</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{models.length === 0 ? (
					<TableRow>
						<TableCell colSpan={4} className="text-muted-foreground">
							Nenhum modelo neste provider.
						</TableCell>
					</TableRow>
				) : (
					models.map((model) => (
						<TableRow key={model.id}>
							<TableCell>{model.modelId}</TableCell>
							<TableCell>{model.displayName}</TableCell>
							<TableCell>
								<Badge variant={model.enabled ? "default" : "secondary"}>
									{model.enabled ? "Ativo" : "Inativo"}
								</Badge>
							</TableCell>
							<TableCell className="space-x-1 text-right">
								<Button
									size="sm"
									variant="outline"
									onClick={() => onEdit(model)}
								>
									Editar
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={busy}
									onClick={() => onDelete(model)}
								>
									Excluir
								</Button>
							</TableCell>
						</TableRow>
					))
				)}
			</TableBody>
		</Table>
	);
}
