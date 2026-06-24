import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ProviderDialog } from "@/features/admin/components/provider-dialog";
import {
	ProviderTestDialog,
	type ProviderTestResult,
} from "@/features/admin/components/provider-test-dialog";
import {
	type ProviderRow,
	ProvidersTable,
} from "@/features/admin/components/providers-table";
import { usePanelAction } from "@/features/admin/hooks/use-panel-action";
import type {
	CreateProviderFormValues,
	EditProviderFormValues,
} from "@/features/admin/schemas/provider";

type ProvidersPanelProps = {
	providers: ProviderRow[];
	onCreate: (values: CreateProviderFormValues) => Promise<void>;
	onUpdate: (id: string, values: EditProviderFormValues) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	onTest: (input: { id: string }) => Promise<ProviderTestResult>;
};

export function ProvidersPanel({
	providers,
	onCreate,
	onUpdate,
	onDelete,
	onTest,
}: ProvidersPanelProps) {
	const [dialog, setDialog] = useState<"create" | ProviderRow | null>(null);
	const [testDialog, setTestDialog] = useState<{
		provider: ProviderRow;
		result: ProviderTestResult;
	} | null>(null);
	const { error, busy, run } = usePanelAction();

	const handleTest = async (provider: ProviderRow) => {
		const result = await onTest({ id: provider.id });
		setTestDialog({ provider, result });
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div>
					<CardTitle>Providers</CardTitle>
					<CardDescription>
						Conexões OpenAI-compatíveis. API keys ficam criptografadas.
					</CardDescription>
				</div>
				<Button size="sm" onClick={() => setDialog("create")}>
					Novo provider
				</Button>
			</CardHeader>
			<CardContent className="space-y-4">
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
				<ProvidersTable
					providers={providers}
					busy={busy}
					onEdit={setDialog}
					onTest={(provider) => run(() => handleTest(provider))}
					onDelete={(provider) =>
						run(async () => {
							if (!window.confirm(`Excluir provider "${provider.name}"?`)) {
								return;
							}
							await onDelete(provider.id);
						})
					}
				/>
			</CardContent>
			<ProviderDialog
				dialog={dialog}
				busy={busy}
				onClose={() => setDialog(null)}
				onCreate={(values) =>
					run(async () => {
						await onCreate(values);
						setDialog(null);
					})
				}
				onUpdate={(id, values) =>
					run(async () => {
						await onUpdate(id, values);
						setDialog(null);
					})
				}
			/>
			<ProviderTestDialog
				provider={testDialog?.provider ?? null}
				result={testDialog?.result ?? null}
				busy={busy}
				onRetry={
					testDialog?.provider
						? () => run(() => handleTest(testDialog.provider))
						: undefined
				}
				onClose={() => setTestDialog(null)}
			/>
		</Card>
	);
}
