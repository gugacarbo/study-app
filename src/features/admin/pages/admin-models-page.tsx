import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelsPanel } from "@/features/admin/components/models-panel";
import { useAdminAiConfig } from "@/features/admin/hooks/use-admin-ai-config";

function ModelsSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-12 w-full" />
			<Skeleton className="h-64 w-full" />
		</div>
	);
}

export function AdminModelsPageContent() {
	const {
		data,
		discoverModels,
		upsertModel,
		deleteModel,
	} = useAdminAiConfig();

	return (
		<div className="space-y-6">
			<ModelsPanel
				providers={data.providers}
				models={data.models}
				onUpsert={async (providerId, values) => {
					await upsertModel.mutateAsync({ data: { providerId, ...values } });
				}}
				onDelete={async (id) => {
					await deleteModel.mutateAsync({ data: { id } });
				}}
				onDiscover={(providerId) =>
					discoverModels.mutateAsync({ data: { providerId } })
				}
			/>
		</div>
	);
}

export function AdminModelsPage() {
	return (
		<Suspense fallback={<ModelsSkeleton />}>
			<AdminModelsPageContent />
		</Suspense>
	);
}
