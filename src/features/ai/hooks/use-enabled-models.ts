import { useSuspenseQuery } from "@tanstack/react-query";
import { listEnabledModels } from "@/server-functions/ai-models";

export function useEnabledAiModels() {
	return useSuspenseQuery({
		queryKey: ["ai-models-enabled"],
		queryFn: () => listEnabledModels(),
	});
}
