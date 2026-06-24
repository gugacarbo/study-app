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

export function getModelStatusBadge(model: ModelRow) {
	if (model.healthStatus === "active") {
		return {
			label: "Active",
			variant: "outline" as const,
			className:
				"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-300",
		};
	}

	return {
		label: "Offline",
		variant: "outline" as const,
		className:
			"border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-300",
	};
}

type ModelsTableProps = {
	models: ModelRow[];
	busy: boolean;
	onEdit: (model: ModelRow) => void;
	onDelete: (model: ModelRow) => void;
	onTest: (model: ModelRow) => void;
};

export function ModelsTable({
	models,
	busy,
	onEdit,
	onDelete,
	onTest,
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
								{(() => {
									const status = getModelStatusBadge(model);
									return (
										<Badge
											variant={status.variant}
											className={status.className}
										>
											{status.label}
										</Badge>
									);
								})()}
							</TableCell>
							<TableCell className="space-x-1 text-right">
								<Button
									size="sm"
									variant="secondary"
									disabled={busy}
									onClick={() => onTest(model)}
								>
									Testar
								</Button>
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
