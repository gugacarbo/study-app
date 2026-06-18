import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type AiProviderRow = typeof schema.aiProviders.$inferSelect;

export async function listByUserId(db: AppDatabase, userId: string) {
	return db
		.select()
		.from(schema.aiProviders)
		.where(eq(schema.aiProviders.userId, userId));
}

export async function getByIdForUser(
	db: AppDatabase,
	providerId: string,
	userId: string,
) {
	const rows = await db
		.select()
		.from(schema.aiProviders)
		.where(
			and(
				eq(schema.aiProviders.id, providerId),
				eq(schema.aiProviders.userId, userId),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

export async function insert(
	db: AppDatabase,
	input: {
		id: string;
		userId: string;
		name: string;
		baseUrl: string;
		apiKey: string;
		enabled?: boolean;
	},
) {
	await db.insert(schema.aiProviders).values({
		id: input.id,
		userId: input.userId,
		name: input.name,
		baseUrl: input.baseUrl,
		apiKey: input.apiKey,
		enabled: input.enabled ?? true,
	});
}

export async function update(
	db: AppDatabase,
	providerId: string,
	userId: string,
	input: {
		name?: string;
		baseUrl?: string;
		apiKey?: string;
		enabled?: boolean;
	},
) {
	const patch: Partial<typeof schema.aiProviders.$inferInsert> = {};
	if (input.name !== undefined) patch.name = input.name;
	if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl;
	if (input.apiKey !== undefined) patch.apiKey = input.apiKey;
	if (input.enabled !== undefined) patch.enabled = input.enabled;
	if (Object.keys(patch).length === 0) return;

	await db
		.update(schema.aiProviders)
		.set(patch)
		.where(
			and(
				eq(schema.aiProviders.id, providerId),
				eq(schema.aiProviders.userId, userId),
			),
		);
}

export async function deleteProvider(
	db: AppDatabase,
	providerId: string,
	userId: string,
) {
	await db
		.delete(schema.aiProviders)
		.where(
			and(
				eq(schema.aiProviders.id, providerId),
				eq(schema.aiProviders.userId, userId),
			),
		);
}
