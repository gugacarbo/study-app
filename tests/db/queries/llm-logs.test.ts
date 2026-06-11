import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
	gets: [] as unknown[],
	alls: [] as unknown[],
	calls: [] as Array<{ method: string; args: unknown[] }>,
};

class FakeSelectBuilder {
	where(...args: unknown[]) {
		state.calls.push({ method: "where", args });
		return this;
	}
	orderBy(...args: unknown[]) {
		state.calls.push({ method: "orderBy", args });
		return this;
	}
	limit(...args: unknown[]) {
		state.calls.push({ method: "limit", args });
		return this;
	}
	offset(...args: unknown[]) {
		state.calls.push({ method: "offset", args });
		return this;
	}
	async get() {
		if (state.gets.length === 0) throw new Error("Missing queued get() response");
		return state.gets.shift();
	}
	async all() {
		if (state.alls.length === 0) throw new Error("Missing queued all() response");
		return state.alls.shift();
	}
}

class FakeDrizzle {
	select(...args: unknown[]) {
		state.calls.push({ method: "select", args });
		return {
			from: (...fromArgs: unknown[]) => {
				state.calls.push({ method: "from", args: fromArgs });
				return new FakeSelectBuilder();
			},
		};
	}
}

vi.mock("drizzle-orm/d1", () => ({
	drizzle: vi.fn(() => new FakeDrizzle()),
}));

import { DBQueries } from "#/db/queries";

const summaryRow = {
	id: 1,
	call_id: "chat-abc-1",
	call_type: "chat",
	provider: "OpenRouter",
	model: "test/model",
	base_url: "https://openrouter.ai/api/v1",
	duration_ms: 120,
	chunks: 3,
	final_chars: 42,
	token_meta: '{"inputTokens":10}',
	error_message: null,
	status: "success",
	created_at: "2026-06-11T10:00:00.000Z",
};

describe("listLLMLogsPaged", () => {
	let queries: DBQueries;

	beforeEach(() => {
		state.gets = [];
		state.alls = [];
		state.calls = [];
		queries = new DBQueries({} as never);
	});

	it("normalizes pagination bounds and returns summary items", async () => {
		state.gets.push({ count: 25 });
		state.alls.push([summaryRow]);

		const result = await queries.listLLMLogsPaged({ page: -1, pageSize: 100 });

		expect(result.items).toEqual([
			{
				...summaryRow,
				status: "success",
			},
		]);
		expect(result.pagination).toEqual({
			page: 1,
			pageSize: 50,
			totalItems: 25,
			totalPages: 1,
			hasNextPage: false,
			hasPrevPage: false,
		});

		const limitCall = state.calls.find((c) => c.method === "limit");
		const offsetCall = state.calls.find((c) => c.method === "offset");
		expect(limitCall?.args).toEqual([50]);
		expect(offsetCall?.args).toEqual([0]);
	});

	it("computes offset for later pages", async () => {
		state.gets.push({ count: 30 });
		state.alls.push([summaryRow]);

		const result = await queries.listLLMLogsPaged({ page: 2, pageSize: 10 });

		expect(result.pagination).toEqual({
			page: 2,
			pageSize: 10,
			totalItems: 30,
			totalPages: 3,
			hasNextPage: true,
			hasPrevPage: true,
		});

		const limitCall = state.calls.find((c) => c.method === "limit");
		const offsetCall = state.calls.find((c) => c.method === "offset");
		expect(limitCall?.args).toEqual([10]);
		expect(offsetCall?.args).toEqual([10]);
	});

	it("applies optional filters via where clauses", async () => {
		state.gets.push({ count: 1 });
		state.alls.push([summaryRow]);

		await queries.listLLMLogsPaged({
			status: "failed",
			callType: "ingest.extract",
			provider: "OpenRouter",
			model: "test/model",
		});

		const whereCalls = state.calls.filter((c) => c.method === "where");
		expect(whereCalls.length).toBeGreaterThanOrEqual(2);
	});

	it("omits where when no filters are provided", async () => {
		state.gets.push({ count: 0 });
		state.alls.push([]);

		await queries.listLLMLogsPaged();

		const whereCalls = state.calls.filter((c) => c.method === "where");
		expect(whereCalls).toHaveLength(2);
		for (const call of whereCalls) {
			expect(call.args[0]).toBeUndefined();
		}
	});

	it("orders by created_at and id descending", async () => {
		state.gets.push({ count: 0 });
		state.alls.push([]);

		await queries.listLLMLogsPaged();

		const orderByCall = state.calls.find((c) => c.method === "orderBy");
		expect(orderByCall).toBeDefined();
		expect(orderByCall?.args).toHaveLength(2);
	});
});

describe("getLLMLogById", () => {
	let queries: DBQueries;

	beforeEach(() => {
		state.gets = [];
		state.alls = [];
		state.calls = [];
		queries = new DBQueries({} as never);
	});

	it("returns full detail including payloads when found", async () => {
		state.gets.push({
			...summaryRow,
			system_prompt: "You are helpful.",
			request_payload: '{"messages":[]}',
			response_payload: '{"text":"hi"}',
		});

		const result = await queries.getLLMLogById(1);

		expect(result).toEqual({
			...summaryRow,
			status: "success",
			system_prompt: "You are helpful.",
			request_payload: '{"messages":[]}',
			response_payload: '{"text":"hi"}',
		});

		const whereCalls = state.calls.filter((c) => c.method === "where");
		expect(whereCalls.length).toBeGreaterThanOrEqual(1);
	});

	it("returns null when log is not found", async () => {
		state.gets.push(undefined);

		const result = await queries.getLLMLogById(999);

		expect(result).toBeNull();
	});
});
