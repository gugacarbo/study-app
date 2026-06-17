import type { AiModelPublic } from "@/db/queries/types";

export type ModelProviderGroup = {
	providerId: number;
	providerName: string;
	models: AiModelPublic[];
};

export function groupModelsByProvider(
	models: AiModelPublic[],
): ModelProviderGroup[] {
	const byProvider = new Map<number, ModelProviderGroup>();

	for (const model of models) {
		let group = byProvider.get(model.providerId);
		if (!group) {
			group = {
				providerId: model.providerId,
				providerName: model.providerName,
				models: [],
			};
			byProvider.set(model.providerId, group);
		}
		group.models.push(model);
	}

	const groups = Array.from(byProvider.values());
	for (const group of groups) {
		group.models.sort((left, right) =>
			left.displayName.localeCompare(right.displayName, undefined, {
				sensitivity: "base",
			}),
		);
	}

	return groups.sort((left, right) =>
		left.providerName.localeCompare(right.providerName, undefined, {
			sensitivity: "base",
		}),
	);
}
