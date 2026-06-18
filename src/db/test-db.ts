import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { AppDatabase } from "@/db/client";
import * as schema from "@/db/schema";

export function createTestDb(): AppDatabase {
	const sqlite = new Database(":memory:");
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: "migrations" });
	return db as unknown as AppDatabase;
}
