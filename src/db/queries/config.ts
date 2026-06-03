import { eq } from "drizzle-orm";
import * as schema from "../schema";
import type { DBQueries } from "./base";

export function getConfig(
	this: DBQueries,
	key: string,
): Promise<string | null> {
	return this.db
		.select()
		.from(schema.config)
		.where(eq(schema.config.key, key))
		.get()
		.then((result) => result?.value ?? null);
}

export function setConfig(
	this: DBQueries,
	key: string,
	value: string,
): Promise<void> {
	return this.db
		.insert(schema.config)
		.values({ key, value })
		.onConflictDoUpdate({ target: schema.config.key, set: { value } })
		.run()
		.then(() => undefined);
}

export function getAllConfig(this: DBQueries): Promise<Record<string, string>> {
	return this.db
		.select()
		.from(schema.config)
		.all()
		.then((rows) => Object.fromEntries(rows.map((r) => [r.key, r.value])));
}
