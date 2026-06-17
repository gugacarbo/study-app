import { describe, expect, it } from "vitest";
import type { AiModelPublic } from "@/db/queries/types";
import { groupModelsByProvider } from "@/features/ai/lib/group-models-by-provider";

function makeModel(
	overrides: Pick<AiModelPublic, "id" | "providerId" | "providerName" | "displayName">,
): AiModelPublic {
	return {
		modelId: `model-${overrides.id}`,
		contextWindow: null,
		maxOutputTokens: null,
		inputCostPerMillion: null,
		outputCostPerMillion: null,
		thinkingEffortLevels: [],
		defaultThinkingEffort: null,
		thinkingEnabled: null,
		thinkingParamName: null,
		enabled: true,
		metadata: null,
		requestParams: {},
		...overrides,
	};
}

describe("groupModelsByProvider", () => {
	it("groups models by provider and sorts providers and models alphabetically", () => {
		const groups = groupModelsByProvider([
			makeModel({
				id: 1,
				providerId: 2,
				providerName: "Zeta",
				displayName: "Beta",
			}),
			makeModel({
				id: 2,
				providerId: 1,
				providerName: "Alpha",
				displayName: "Zulu",
			}),
			makeModel({
				id: 3,
				providerId: 1,
				providerName: "Alpha",
				displayName: "Alpha",
			}),
		]);

		expect(groups).toEqual([
			{
				providerId: 1,
				providerName: "Alpha",
				models: [
					makeModel({
						id: 3,
						providerId: 1,
						providerName: "Alpha",
						displayName: "Alpha",
					}),
					makeModel({
						id: 2,
						providerId: 1,
						providerName: "Alpha",
						displayName: "Zulu",
					}),
				],
			},
			{
				providerId: 2,
				providerName: "Zeta",
				models: [
					makeModel({
						id: 1,
						providerId: 2,
						providerName: "Zeta",
						displayName: "Beta",
					}),
				],
			},
		]);
	});
});
