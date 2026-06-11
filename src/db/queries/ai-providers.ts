import { eq } from "drizzle-orm";
import * as schema from "../schema";
import type { DBQueries } from "./base";
import type { AiProviderPublic, AiProviderRecord } from "./types";

function toPublicProvider(row: AiProviderRecord): AiProviderPublic {
	return {
		id: row.id,
		name: row.name,
		baseUrl: row.base_url,
		hasApiKey: Boolean(row.api_key?.trim()),
		enabled: row.enabled,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function listAiProviders(this: DBQueries): Promise<AiProviderPublic[]> {
	return this.db
		.select()
		.from(schema.aiProviders)
		.orderBy(schema.aiProviders.name)
		.all()
		.then((rows) => rows.map((row) => toPublicProvider(row)));
}

export function getAiProviderById(
	this: DBQueries,
	id: number,
): Promise<AiProviderRecord | null> {
	return this.db
		.select()
		.from(schema.aiProviders)
		.where(eq(schema.aiProviders.id, id))
		.get()
		.then((row) => row ?? null);
}

export function insertAiProvider(
	this: DBQueries,
	data: {
		name: string;
		baseUrl: string;
		apiKey: string;
		enabled?: boolean;
	},
): Promise<number> {
	return this.db
		.insert(schema.aiProviders)
		.values({
			name: data.name,
			base_url: data.baseUrl,
			api_key: data.apiKey,
			enabled: data.enabled ?? true,
		})
		.returning({ id: schema.aiProviders.id })
		.get()
		.then((row) => row?.id ?? 0);
}

export function updateAiProvider(
	this: DBQueries,
	id: number,
	data: {
		name?: string;
		baseUrl?: string;
		apiKey?: string;
		enabled?: boolean;
	},
): Promise<void> {
	const values: Partial<typeof schema.aiProviders.$inferInsert> = {
		updated_at: new Date().toISOString(),
	};
	if (data.name !== undefined) values.name = data.name;
	if (data.baseUrl !== undefined) values.base_url = data.baseUrl;
	if (data.apiKey !== undefined) values.api_key = data.apiKey;
	if (data.enabled !== undefined) values.enabled = data.enabled;

	return this.db
		.update(schema.aiProviders)
		.set(values)
		.where(eq(schema.aiProviders.id, id))
		.run()
		.then(() => undefined);
}

export function deleteAiProvider(this: DBQueries, id: number): Promise<void> {
	return this.db
		.delete(schema.aiProviders)
		.where(eq(schema.aiProviders.id, id))
		.run()
		.then(() => undefined);
}
