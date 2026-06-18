import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ProviderForm } from "@/features/admin/components/provider-form";
import type { ProviderRow } from "@/features/admin/components/providers-table";
import type {
	CreateProviderFormValues,
	EditProviderFormValues,
} from "@/features/admin/schemas/provider";

type ProviderDialogProps = {
	dialog: "create" | ProviderRow | null;
	busy: boolean;
	onClose: () => void;
	onCreate: (values: CreateProviderFormValues) => Promise<void>;
	onUpdate: (id: string, values: EditProviderFormValues) => Promise<void>;
};

export function ProviderDialog({
	dialog,
	busy,
	onClose,
	onCreate,
	onUpdate,
}: ProviderDialogProps) {
	return (
		<Dialog open={dialog !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{dialog === "create" ? "Novo provider" : "Editar provider"}
					</DialogTitle>
				</DialogHeader>
				{dialog === "create" ? (
					<ProviderForm
						mode="create"
						submitLabel="Criar"
						isSubmitting={busy}
						onCancel={onClose}
						onSubmit={(values) => onCreate(values as CreateProviderFormValues)}
					/>
				) : dialog ? (
					<ProviderForm
						mode="edit"
						apiKeyMasked={dialog.apiKeyMasked}
						hasApiKey={dialog.hasApiKey}
						defaultValues={{
							name: dialog.name,
							baseUrl: dialog.baseUrl,
							enabled: dialog.enabled,
						}}
						submitLabel="Salvar"
						isSubmitting={busy}
						onCancel={onClose}
						onSubmit={(values) => onUpdate(dialog.id, values)}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
