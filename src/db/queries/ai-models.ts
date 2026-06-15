import { and, eq } from "drizzle-orm";
import type { RequestParams, ThinkingEffortLevel } from "@/lib/validation";
import * as schema from "../schema";
import {
	parseRequestParams,
	serializeRequestParams,
} from "./ai-model-request-params";
import {
	parseDefaultThinkingEffort,
	parseThinkingEffortLevels,
	serializeThinkingEffortLevels,
} from "./ai-model-thinking-effort";
import type { DBQueries } from "./base";
import type {
	AiModelPublic,
	AiModelRecord,
	AiModelResolved,
	AiModelWithProvider,
} from "./types";

function toPublicModel(row: AiModelWithProvider): AiModelPublic {
	const thinkingEffortLevels = parseThinkingEffortLevels(
		row.thinking_effort_levels,
	);

	return {
		id: row.id,
		providerId: row.provider_id,
		providerName: row.provider_name,
		modelId: row.model_id,
		displayName: row.display_name,
		contextWindow: row.context_window,
		maxOutputTokens: row.max_output_tokens,
		inputCostPerMillion: row.input_cost_per_million,
		outputCostPerMillion: row.output_cost_per_million,
		thinkingEffortLevels,
		defaultThinkingEffort: parseDefaultThinkingEffort(
			row.default_thinking_effort,
			thinkingEffortLevels,
		),
		thinkingEnabled: row.thinking_enabled,
		enabled: row.enabled,
		metadata: row.metadata,
		requestParams: parseRequestParams(row.request_params),
	};
}

function modelWithProviderSelect(db: DBQueries["db"]) {
	return db
		.select({
			id: schema.aiModels.id,
			provider_id: schema.aiModels.provider_id,
			model_id: schema.aiModels.model_id,
			display_name: schema.aiModels.display_name,
			context_window: schema.aiModels.context_window,
			max_output_tokens: schema.aiModels.max_output_tokens,
			input_cost_per_million: schema.aiModels.input_cost_per_million,
			output_cost_per_million: schema.aiModels.output_cost_per_million,
			thinking_effort_levels: schema.aiModels.thinking_effort_levels,
			default_thinking_effort: schema.aiModels.default_thinking_effort,
			thinking_enabled: schema.aiModels.thinking_enabled,
			enabled: schema.aiModels.enabled,
			metadata: schema.aiModels.metadata,
			request_params: schema.aiModels.request_params,
			created_at: schema.aiModels.created_at,
			updated_at: schema.aiModels.updated_at,
			provider_name: schema.aiProviders.name,
			provider_base_url: schema.aiProviders.base_url,
			provider_enabled: schema.aiProviders.enabled,
		})
		.from(schema.aiModels)
		.innerJoin(
			schema.aiProviders,
			eq(schema.aiModels.provider_id, schema.aiProviders.id),
		);
}

export function listAiModels(
	this: DBQueries,
	providerId?: number,
): Promise<AiModelPublic[]> {
	const query = modelWithProviderSelect(this.db);
	const promise =
		providerId === undefined
			? query.all()
			: query.where(eq(schema.aiModels.provider_id, providerId)).all();
	return promise.then((rows) => rows.map((row) => toPublicModel(row)));
}

export function listEnabledAiModels(this: DBQueries): Promise<AiModelPublic[]> {
	return modelWithProviderSelect(this.db)
		.where(
			and(
				eq(schema.aiModels.enabled, true),
				eq(schema.aiProviders.enabled, true),
			),
		)
		.all()
		.then((rows) => rows.map((row) => toPublicModel(row)));
}

export function getAiModelById(
	this: DBQueries,
	id: number,
): Promise<AiModelRecord | null> {
	return this.db
		.select()
		.from(schema.aiModels)
		.where(eq(schema.aiModels.id, id))
		.get()
		.then((row) => row ?? null);
}

export function getResolvedAiModelById(
	this: DBQueries,
	id: number,
): Promise<AiModelResolved | null> {
	return modelWithProviderSelect(this.db)
		.where(eq(schema.aiModels.id, id))
		.get()
		.then(async (row) => {
			if (!row) return null;
			const provider = await this.getAiProviderById(row.provider_id);
			if (!provider || !row.enabled || !row.provider_enabled) return null;
			return {
				...toPublicModel(row),
				providerBaseUrl: row.provider_base_url,
				providerApiKey: provider.api_key,
			};
		});
}

export function insertAiModel(
	this: DBQueries,
	data: {
		providerId: number;
		modelId: string;
		displayName: string;
		contextWindow?: number | null;
		maxOutputTokens?: number | null;
		inputCostPerMillion?: number | null;
		outputCostPerMillion?: number | null;
		thinkingEffortLevels?: ThinkingEffortLevel[];
		defaultThinkingEffort?: ThinkingEffortLevel | null;
		thinkingEnabled?: boolean | null;
		enabled?: boolean;
		metadata?: string | null;
		requestParams?: RequestParams;
	},
): Promise<number> {
	return this.db
		.insert(schema.aiModels)
		.values({
			provider_id: data.providerId,
			model_id: data.modelId,
			display_name: data.displayName,
			context_window: data.contextWindow ?? null,
			max_output_tokens: data.maxOutputTokens ?? null,
			input_cost_per_million: data.inputCostPerMillion ?? null,
			output_cost_per_million: data.outputCostPerMillion ?? null,
			thinking_effort_levels: serializeThinkingEffortLevels(
				data.thinkingEffortLevels ?? [],
			),
			default_thinking_effort: data.defaultThinkingEffort ?? null,
			thinking_enabled: data.thinkingEnabled ?? null,
			enabled: data.enabled ?? true,
			metadata: data.metadata ?? null,
			request_params: serializeRequestParams(data.requestParams),
		})
		.returning({ id: schema.aiModels.id })
		.get()
		.then((row) => row?.id ?? 0);
}

export function updateAiModel(
	this: DBQueries,
	id: number,
	data: {
		modelId?: string;
		displayName?: string;
		contextWindow?: number | null;
		maxOutputTokens?: number | null;
		inputCostPerMillion?: number | null;
		outputCostPerMillion?: number | null;
		thinkingEffortLevels?: ThinkingEffortLevel[];
		defaultThinkingEffort?: ThinkingEffortLevel | null;
		thinkingEnabled?: boolean | null;
		enabled?: boolean;
		metadata?: string | null;
		requestParams?: RequestParams;
	},
): Promise<void> {
	const values: Partial<typeof schema.aiModels.$inferInsert> = {
		updated_at: new Date().toISOString(),
	};
	if (data.modelId !== undefined) values.model_id = data.modelId;
	if (data.displayName !== undefined) values.display_name = data.displayName;
	if (data.contextWindow !== undefined)
		values.context_window = data.contextWindow;
	if (data.maxOutputTokens !== undefined) {
		values.max_output_tokens = data.maxOutputTokens;
	}
	if (data.inputCostPerMillion !== undefined) {
		values.input_cost_per_million = data.inputCostPerMillion;
	}
	if (data.outputCostPerMillion !== undefined) {
		values.output_cost_per_million = data.outputCostPerMillion;
	}
	if (data.thinkingEffortLevels !== undefined) {
		values.thinking_effort_levels = serializeThinkingEffortLevels(
			data.thinkingEffortLevels,
		);
	}
	if (data.defaultThinkingEffort !== undefined) {
		values.default_thinking_effort = data.defaultThinkingEffort;
	}
	if (data.thinkingEnabled !== undefined) {
		values.thinking_enabled = data.thinkingEnabled;
	}
	if (data.enabled !== undefined) values.enabled = data.enabled;
	if (data.metadata !== undefined) values.metadata = data.metadata;
	if (data.requestParams !== undefined) {
		values.request_params = serializeRequestParams(data.requestParams);
	}

	return this.db
		.update(schema.aiModels)
		.set(values)
		.where(eq(schema.aiModels.id, id))
		.run()
		.then(() => undefined);
}

export function deleteAiModel(this: DBQueries, id: number): Promise<void> {
	return this.db
		.delete(schema.aiModels)
		.where(eq(schema.aiModels.id, id))
		.run()
		.then(() => undefined);
}
