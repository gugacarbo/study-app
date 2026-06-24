import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type AiModelRow = typeof schema.aiModels.$inferSelect;
export type AiModelHealthStatus = "active" | "offline";

export async function listByProviderForUser(
	db: AppDatabase,
	providerId: string,
	userId: string,
) {
	const rows = await db
		.select({ model: schema.aiModels })
		.from(schema.aiModels)
		.innerJoin(
			schema.aiProviders,
			eq(schema.aiModels.providerId, schema.aiProviders.id),
		)
		.where(
			and(
				eq(schema.aiModels.providerId, providerId),
				eq(schema.aiProviders.userId, userId),
			),
		);
	return rows.map((row) => row.model);
}

export async function getByIdForUser(
	db: AppDatabase,
	modelId: string,
	userId: string,
) {
	const rows = await db
		.select({
			model: schema.aiModels,
			providerUserId: schema.aiProviders.userId,
		})
		.from(schema.aiModels)
		.innerJoin(
			schema.aiProviders,
			eq(schema.aiModels.providerId, schema.aiProviders.id),
		)
		.where(eq(schema.aiModels.id, modelId))
		.limit(1);
	const row = rows[0];
	if (!row || row.providerUserId !== userId) return null;
	return row.model;
}

export type AiModelUpsertInput = {
	id: string;
	providerId: string;
	modelId: string;
	displayName: string;
	contextWindow?: number | null;
	maxOutputTokens?: number | null;
	inputCostPerMillion?: number | null;
	outputCostPerMillion?: number | null;
	thinkingEffortLevels?: string | null;
	defaultThinkingEffort?: string | null;
	thinkingEnabled?: boolean | null;
	thinkingParamName?: string | null;
	enabled?: boolean;
	metadata?: string | null;
	requestParams?: string | null;
};

export async function upsert(db: AppDatabase, input: AiModelUpsertInput) {
	const values = {
		id: input.id,
		providerId: input.providerId,
		modelId: input.modelId,
		displayName: input.displayName,
		contextWindow: input.contextWindow ?? null,
		maxOutputTokens: input.maxOutputTokens ?? null,
		inputCostPerMillion: input.inputCostPerMillion ?? null,
		outputCostPerMillion: input.outputCostPerMillion ?? null,
		thinkingEffortLevels: input.thinkingEffortLevels ?? null,
		defaultThinkingEffort: input.defaultThinkingEffort ?? null,
		thinkingEnabled: input.thinkingEnabled ?? null,
		thinkingParamName: input.thinkingParamName ?? null,
		enabled: input.enabled ?? true,
		healthStatus: "offline" as const,
		metadata: input.metadata ?? null,
		requestParams: input.requestParams ?? null,
	};

	await db
		.insert(schema.aiModels)
		.values(values)
		.onConflictDoUpdate({
			target: [schema.aiModels.providerId, schema.aiModels.modelId],
			set: {
				displayName: input.displayName,
				contextWindow: input.contextWindow ?? null,
				maxOutputTokens: input.maxOutputTokens ?? null,
				inputCostPerMillion: input.inputCostPerMillion ?? null,
				outputCostPerMillion: input.outputCostPerMillion ?? null,
				thinkingEffortLevels: input.thinkingEffortLevels ?? null,
				defaultThinkingEffort: input.defaultThinkingEffort ?? null,
				thinkingEnabled: input.thinkingEnabled ?? null,
				thinkingParamName: input.thinkingParamName ?? null,
				enabled: input.enabled ?? true,
				metadata: input.metadata ?? null,
				requestParams: input.requestParams ?? null,
			},
		});

	const rows = await db
		.select({ id: schema.aiModels.id })
		.from(schema.aiModels)
		.where(
			and(
				eq(schema.aiModels.providerId, input.providerId),
				eq(schema.aiModels.modelId, input.modelId),
			),
		)
		.limit(1);
	return rows[0]?.id ?? input.id;
}

export async function deleteModel(
	db: AppDatabase,
	modelId: string,
	userId: string,
) {
	const owned = await getByIdForUser(db, modelId, userId);
	if (!owned) return;
	await db.delete(schema.aiModels).where(eq(schema.aiModels.id, modelId));
}

export async function updateHealthStatus(
	db: AppDatabase,
	modelId: string,
	userId: string,
	healthStatus: AiModelHealthStatus,
) {
	const owned = await getByIdForUser(db, modelId, userId);
	if (!owned) return false;

	await db
		.update(schema.aiModels)
		.set({
			healthStatus,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.aiModels.id, modelId));

	return true;
}
