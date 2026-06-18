import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const aiProviders = sqliteTable(
	"ai_providers",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		baseUrl: text("base_url").notNull(),
		apiKey: text("api_key").notNull(),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("idx_ai_providers_user_id").on(table.userId)],
);

export const aiModels = sqliteTable(
	"ai_models",
	{
		id: text("id").primaryKey(),
		providerId: text("provider_id")
			.notNull()
			.references(() => aiProviders.id, { onDelete: "cascade" }),
		modelId: text("model_id").notNull(),
		displayName: text("display_name").notNull(),
		contextWindow: integer("context_window"),
		maxOutputTokens: integer("max_output_tokens"),
		inputCostPerMillion: real("input_cost_per_million"),
		outputCostPerMillion: real("output_cost_per_million"),
		thinkingEffortLevels: text("thinking_effort_levels"),
		defaultThinkingEffort: text("default_thinking_effort"),
		thinkingEnabled: integer("thinking_enabled", { mode: "boolean" }),
		thinkingParamName: text("thinking_param_name"),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		metadata: text("metadata"),
		requestParams: text("request_params"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_ai_models_provider_id").on(table.providerId),
		uniqueIndex("uq_ai_models_provider_model").on(
			table.providerId,
			table.modelId,
		),
	],
);

export const config = sqliteTable(
	"config",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		value: text("value").notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.key] })],
);
