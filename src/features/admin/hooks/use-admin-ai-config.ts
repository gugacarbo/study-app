import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { getAdminAiConfig } from "@/functions/admin/config";
import {
	deleteModel,
	setDefaultModel,
	upsertModel,
} from "@/functions/admin/models";
import {
	createProvider,
	deleteProvider,
	discoverModels,
	testProvider,
	updateProvider,
} from "@/functions/admin/providers";

export const ADMIN_AI_CONFIG_KEY = ["admin", "ai-config"] as const;

export type AdminAiConfig = Awaited<ReturnType<typeof getAdminAiConfig>>;

export function useAdminAiConfig() {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ADMIN_AI_CONFIG_KEY });

	const query = useSuspenseQuery({
		queryKey: ADMIN_AI_CONFIG_KEY,
		queryFn: () => getAdminAiConfig(),
	});

	const createProviderMutation = useMutation({
		mutationFn: createProvider,
		onSuccess: invalidate,
	});
	const updateProviderMutation = useMutation({
		mutationFn: updateProvider,
		onSuccess: invalidate,
	});
	const deleteProviderMutation = useMutation({
		mutationFn: deleteProvider,
		onSuccess: invalidate,
	});
	const testProviderMutation = useMutation({
		mutationFn: testProvider,
	});
	const discoverModelsMutation = useMutation({
		mutationFn: discoverModels,
	});
	const upsertModelMutation = useMutation({
		mutationFn: upsertModel,
		onSuccess: invalidate,
	});
	const deleteModelMutation = useMutation({
		mutationFn: deleteModel,
		onSuccess: invalidate,
	});
	const setDefaultModelMutation = useMutation({
		mutationFn: setDefaultModel,
		onSuccess: invalidate,
	});

	return {
		...query,
		createProvider: createProviderMutation,
		updateProvider: updateProviderMutation,
		deleteProvider: deleteProviderMutation,
		testProvider: testProviderMutation,
		discoverModels: discoverModelsMutation,
		upsertModel: upsertModelMutation,
		deleteModel: deleteModelMutation,
		setDefaultModel: setDefaultModelMutation,
	};
}
