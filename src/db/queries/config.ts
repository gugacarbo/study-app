import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export const CONFIG_KEY_DEFAULT_AI_MODEL = "default_ai_model_id";

export async function getConfigValue(
	db: AppDatabase,
	userId: string,
	key: string,
): Promise<string | null> {
	const rows = await db
		.select({ value: schema.config.value })
		.from(schema.config)
		.where(and(eq(schema.config.userId, userId), eq(schema.config.key, key)))
		.limit(1);
	return rows[0]?.value ?? null;
}

export async function setConfigValue(
	db: AppDatabase,
	userId: string,
	key: string,
	value: string,
) {
	await db
		.insert(schema.config)
		.values({ userId, key, value })
		.onConflictDoUpdate({
			target: [schema.config.userId, schema.config.key],
			set: { value },
		});
}

export async function deleteConfigValue(
	db: AppDatabase,
	userId: string,
	key: string,
) {
	await db
		.delete(schema.config)
		.where(and(eq(schema.config.userId, userId), eq(schema.config.key, key)));
}
