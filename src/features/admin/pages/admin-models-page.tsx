import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DefaultModelSelect } from "@/features/admin/components/default-model-select";
import { ModelsPanel } from "@/features/admin/components/models-panel";
import { ProvidersPanel } from "@/features/admin/components/providers-panel";
import { useAdminAiConfig } from "@/features/admin/hooks/use-admin-ai-config";

function ModelsSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-40 w-full" />
			<Skeleton className="h-40 w-full" />
			<Skeleton className="h-24 w-full" />
		</div>
	);
}

export function AdminModelsPageContent() {
	const {
		data,
		createProvider,
		updateProvider,
		deleteProvider,
		testProvider,
		discoverModels,
		upsertModel,
		deleteModel,
		setDefaultModel,
	} = useAdminAiConfig();

	return (
		<div className="space-y-6">
			<ProvidersPanel
				providers={data.providers}
				onCreate={async (values) => {
					await createProvider.mutateAsync({ data: values });
				}}
				onUpdate={async (id, values) => {
					await updateProvider.mutateAsync({ data: { id, ...values } });
				}}
				onDelete={async (id) => {
					await deleteProvider.mutateAsync({ data: { id } });
				}}
				onTest={async (input) => {
					const provider = data.providers.find((p) => p.id === input.id);
					const result = await testProvider.mutateAsync({ data: input });
					return {
						...result,
						providerId: input.id,
						providerName: provider?.name ?? "Provider",
						baseUrl: provider?.baseUrl ?? "",
					};
				}}
			/>
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
			<DefaultModelSelect
				config={data}
				value={data.defaultModelId}
				disabled={setDefaultModel.isPending}
				onChange={(modelId) => setDefaultModel.mutate({ data: { modelId } })}
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
