import { describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import {
	getR2LogById,
	getR2LogsPage,
	getR2LogsStats,
	getR2LogsTimeSeries,
} from "@/db/queries/r2-logs-admin";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

async function seedUser(db: ReturnType<typeof createTestDb>, userId: string) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
}

describe("r2-logs-admin queries", () => {
	it("getR2LogsStats returns zeros when no logs exist", async () => {
		const db = createTestDb();
		const stats = await getR2LogsStats(db, {});
		expect(stats.total).toBe(0);
		expect(stats.success).toBe(0);
		expect(stats.error).toBe(0);
		expect(stats.totalBytes).toBeNull();
		expect(stats.avgDurationMs).toBeNull();
	});

	it("getR2LogsStats aggregates correctly", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		await db.insert(schema.r2OperationLogs).values([
			{ id: createId(), userId, bucket: "files", operation: "put", objectKey: "a.pdf", bytes: 1000, status: "success", durationMs: 50, createdAt: "2026-06-01T00:00:00.000Z" },
			{ id: createId(), userId, bucket: "files", operation: "get", objectKey: "a.pdf", bytes: 1000, status: "success", durationMs: 30, createdAt: "2026-06-01T01:00:00.000Z" },
			{ id: createId(), userId, bucket: "memory", operation: "put", objectKey: "b.json", bytes: 500, status: "error", durationMs: 200, createdAt: "2026-06-02T00:00:00.000Z" },
		]);

		const stats = await getR2LogsStats(db, {});
		expect(stats.total).toBe(3);
		expect(stats.success).toBe(2);
		expect(stats.error).toBe(1);
		expect(stats.totalBytes).toBe(2500);
		expect(stats.avgDurationMs).toBeCloseTo(93.33, 0);
	});

	it("getR2LogsStats filters by operation", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		await db.insert(schema.r2OperationLogs).values([
			{ id: createId(), userId, bucket: "files", operation: "put", objectKey: "a.pdf", status: "success", createdAt: "2026-06-01T00:00:00.000Z" },
			{ id: createId(), userId, bucket: "files", operation: "get", objectKey: "a.pdf", status: "success", createdAt: "2026-06-01T01:00:00.000Z" },
		]);

		const stats = await getR2LogsStats(db, { operation: "put" });
		expect(stats.total).toBe(1);
	});

	it("getR2LogsTimeSeries groups by day", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		await db.insert(schema.r2OperationLogs).values([
			{ id: createId(), userId, bucket: "files", operation: "get", objectKey: "a.pdf", status: "success", createdAt: "2026-06-01T10:00:00.000Z" },
			{ id: createId(), userId, bucket: "files", operation: "get", objectKey: "b.pdf", status: "success", createdAt: "2026-06-01T14:00:00.000Z" },
			{ id: createId(), userId, bucket: "files", operation: "put", objectKey: "c.pdf", status: "error", createdAt: "2026-06-02T10:00:00.000Z" },
		]);

		const series = await getR2LogsTimeSeries(db, "day", {});
		expect(series).toHaveLength(2);
		expect(series[0].count).toBe(2);
		expect(series[0].errorCount).toBe(0);
		expect(series[1].count).toBe(1);
		expect(series[1].errorCount).toBe(1);
	});

	it("getR2LogsPage paginates correctly", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		for (let i = 0; i < 5; i++) {
			await db.insert(schema.r2OperationLogs).values({
				id: createId(),
				userId,
				bucket: "files",
				operation: "get",
				objectKey: `${i}.pdf`,
				status: "success",
				createdAt: `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
			});
		}

		const page1 = await getR2LogsPage(db, 1, 2, {});
		expect(page1.rows).toHaveLength(2);
		expect(page1.total).toBe(5);

		const page3 = await getR2LogsPage(db, 3, 2, {});
		expect(page3.rows).toHaveLength(1);
	});

	it("getR2LogById returns null for missing log", async () => {
		const db = createTestDb();
		const log = await getR2LogById(db, "nonexistent");
		expect(log).toBeNull();
	});

	it("getR2LogById returns log with all fields", async () => {
		const db = createTestDb();
		const userId = createId();
		const logId = createId();
		await seedUser(db, userId);

		await db.insert(schema.r2OperationLogs).values({
			id: logId,
			userId,
			bucket: "files",
			operation: "put",
			objectKey: "test.pdf",
			bytes: 2048,
			status: "success",
			durationMs: 100,
			createdAt: "2026-06-01T00:00:00.000Z",
		});

		const log = await getR2LogById(db, logId);
		expect(log).not.toBeNull();
		expect(log?.bucket).toBe("files");
		expect(log?.operation).toBe("put");
		expect(log?.bytes).toBe(2048);
	});
});
