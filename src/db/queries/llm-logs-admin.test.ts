import { describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import {
	getLlmLogById,
	getLlmLogsPage,
	getLlmLogsStats,
	getLlmLogsTimeSeries,
} from "@/db/queries/llm-logs-admin";
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

describe("llm-logs-admin queries", () => {
	it("getLlmLogsStats returns zeros when no logs exist", async () => {
		const db = createTestDb();
		const stats = await getLlmLogsStats(db, {});
		expect(stats.total).toBe(0);
		expect(stats.success).toBe(0);
		expect(stats.error).toBe(0);
		expect(stats.pending).toBe(0);
		expect(stats.avgDurationMs).toBeNull();
	});

	it("getLlmLogsStats aggregates correctly", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		await db.insert(schema.llmLogs).values([
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "success", durationMs: 100, createdAt: "2026-06-01T00:00:00.000Z" },
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "success", durationMs: 200, createdAt: "2026-06-01T01:00:00.000Z" },
			{ id: createId(), userId, callId: createId(), callType: "generateObject", provider: "anthropic", model: "claude-3", status: "error", durationMs: 50, createdAt: "2026-06-02T00:00:00.000Z" },
		]);

		const stats = await getLlmLogsStats(db, {});
		expect(stats.total).toBe(3);
		expect(stats.success).toBe(2);
		expect(stats.error).toBe(1);
		expect(stats.pending).toBe(0);
		expect(stats.avgDurationMs).toBeCloseTo(116.67, 0);
	});

	it("getLlmLogsStats filters by status", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		await db.insert(schema.llmLogs).values([
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "success", createdAt: "2026-06-01T00:00:00.000Z" },
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "error", createdAt: "2026-06-01T01:00:00.000Z" },
		]);

		const stats = await getLlmLogsStats(db, { status: "success" });
		expect(stats.total).toBe(1);
		expect(stats.success).toBe(1);
		expect(stats.error).toBe(0);
	});

	it("getLlmLogsTimeSeries groups by day", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		await db.insert(schema.llmLogs).values([
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "success", createdAt: "2026-06-01T10:00:00.000Z" },
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "success", createdAt: "2026-06-01T14:00:00.000Z" },
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "error", createdAt: "2026-06-02T10:00:00.000Z" },
		]);

		const series = await getLlmLogsTimeSeries(db, "day", {});
		expect(series).toHaveLength(2);
		expect(series[0].date).toContain("2026-06-01");
		expect(series[0].count).toBe(2);
		expect(series[0].errorCount).toBe(0);
		expect(series[1].date).toContain("2026-06-02");
		expect(series[1].count).toBe(1);
		expect(series[1].errorCount).toBe(1);
	});

	it("getLlmLogsTimeSeries groups by hour", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		await db.insert(schema.llmLogs).values([
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "success", createdAt: "2026-06-01T10:00:00.000Z" },
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "success", createdAt: "2026-06-01T10:15:00.000Z" },
			{ id: createId(), userId, callId: createId(), callType: "streamText", provider: "openai", model: "gpt-4", status: "error", createdAt: "2026-06-01T11:00:00.000Z" },
		]);

		const series = await getLlmLogsTimeSeries(db, "hour", {});
		expect(series).toHaveLength(2);
		expect(series[0].count).toBe(2);
		expect(series[1].count).toBe(1);
	});

	it("getLlmLogsPage paginates correctly", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		for (let i = 0; i < 10; i++) {
			await db.insert(schema.llmLogs).values({
				id: createId(),
				userId,
				callId: createId(),
				callType: "streamText",
				provider: "openai",
				model: "gpt-4",
				status: "success",
				durationMs: 100,
				createdAt: `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
			});
		}

		const page1 = await getLlmLogsPage(db, 1, 3, {});
		expect(page1.rows).toHaveLength(3);
		expect(page1.total).toBe(10);
		expect(page1.page).toBe(1);
		expect(page1.pageSize).toBe(3);

		const page2 = await getLlmLogsPage(db, 2, 3, {});
		expect(page2.rows).toHaveLength(3);
		expect(page2.page).toBe(2);

		const page4 = await getLlmLogsPage(db, 4, 3, {});
		expect(page4.rows).toHaveLength(1);
	});

	it("getLlmLogById returns null for missing log", async () => {
		const db = createTestDb();
		const log = await getLlmLogById(db, "nonexistent");
		expect(log).toBeNull();
	});

	it("getLlmLogById returns log with all fields", async () => {
		const db = createTestDb();
		const userId = createId();
		const logId = createId();
		await seedUser(db, userId);

		await db.insert(schema.llmLogs).values({
			id: logId,
			userId,
			callId: createId(),
			callType: "streamText",
			provider: "openai",
			model: "gpt-4",
			status: "success",
			durationMs: 150,
			requestPayload: JSON.stringify({ prompt: "hello" }),
			responsePayload: JSON.stringify({ text: "world" }),
			createdAt: "2026-06-01T00:00:00.000Z",
		});

		const log = await getLlmLogById(db, logId);
		expect(log).not.toBeNull();
		expect(log?.callType).toBe("streamText");
		expect(log?.provider).toBe("openai");
		expect(log?.durationMs).toBe(150);
	});

	it("getLlmLogById includes tokenMeta and model costs", async () => {
		const db = createTestDb();
		const userId = createId();
		const providerId = createId();
		const logId = createId();
		await seedUser(db, userId);

		await db.insert(schema.aiProviders).values({
			id: providerId,
			userId,
			name: "OpenAI",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "enc:secret",
		});
		await db.insert(schema.aiModels).values({
			id: createId(),
			providerId,
			modelId: "gpt-4o-mini",
			displayName: "GPT-4o Mini",
			inputCostPerMillion: 0.15,
			outputCostPerMillion: 0.6,
		});

		await db.insert(schema.llmLogs).values({
			id: logId,
			userId,
			callId: createId(),
			callType: "ingest",
			provider: "openai-compatible",
			model: "gpt-4o-mini",
			status: "success",
			tokenMeta: JSON.stringify({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 }),
			createdAt: "2026-06-01T00:00:00.000Z",
		});

		const log = await getLlmLogById(db, logId);
		expect(log?.tokenMeta).toBe(JSON.stringify({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 }));
		expect(log?.inputCostPerMillion).toBe(0.15);
		expect(log?.outputCostPerMillion).toBe(0.6);
	});

	it("getLlmLogsPage includes tokenMeta and model costs", async () => {
		const db = createTestDb();
		const userId = createId();
		const providerId = createId();
		await seedUser(db, userId);

		await db.insert(schema.aiProviders).values({
			id: providerId,
			userId,
			name: "OpenAI",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "enc:secret",
		});
		await db.insert(schema.aiModels).values({
			id: createId(),
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
			inputCostPerMillion: 2.5,
			outputCostPerMillion: 10,
		});

		await db.insert(schema.llmLogs).values({
			id: createId(),
			userId,
			callId: createId(),
			callType: "ingest",
			provider: "openai-compatible",
			model: "gpt-4o",
			status: "success",
			tokenMeta: JSON.stringify({ inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 }),
			createdAt: "2026-06-01T00:00:00.000Z",
		});

		const page = await getLlmLogsPage(db, 1, 10, {});
		expect(page.rows).toHaveLength(1);
		expect(page.rows[0]?.tokenMeta).toBe(JSON.stringify({ inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 }));
		expect(page.rows[0]?.inputCostPerMillion).toBe(2.5);
		expect(page.rows[0]?.outputCostPerMillion).toBe(10);
	});
});
