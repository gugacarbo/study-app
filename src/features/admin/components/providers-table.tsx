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

export type ProviderRow = AdminAiConfig["providers"][number];

type ProvidersTableProps = {
	providers: ProviderRow[];
	busy: boolean;
	onEdit: (provider: ProviderRow) => void;
	onDelete: (provider: ProviderRow) => void;
	onTest: (provider: ProviderRow) => void;
};

export function ProvidersTable({
	providers,
	busy,
	onEdit,
	onDelete,
	onTest,
}: ProvidersTableProps) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Nome</TableHead>
					<TableHead>Base URL</TableHead>
					<TableHead>Key</TableHead>
					<TableHead>Status</TableHead>
					<TableHead className="text-right">Ações</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{providers.length === 0 ? (
					<TableRow>
						<TableCell colSpan={5} className="text-muted-foreground">
							Nenhum provider cadastrado.
						</TableCell>
					</TableRow>
				) : (
					providers.map((provider) => (
						<TableRow key={provider.id}>
							<TableCell className="font-medium">{provider.name}</TableCell>
							<TableCell className="max-w-[12rem] truncate">
								{provider.baseUrl}
							</TableCell>
							<TableCell>
								{provider.hasApiKey ? provider.apiKeyMasked : "—"}
							</TableCell>
							<TableCell>
								<Badge variant={provider.enabled ? "default" : "secondary"}>
									{provider.enabled ? "Ativo" : "Inativo"}
								</Badge>
							</TableCell>
							<TableCell className="space-x-1 text-right">
								<Button
									size="sm"
									variant="outline"
									disabled={busy}
									onClick={() => onTest(provider)}
								>
									Testar
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => onEdit(provider)}
								>
									Editar
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={busy}
									onClick={() => onDelete(provider)}
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
