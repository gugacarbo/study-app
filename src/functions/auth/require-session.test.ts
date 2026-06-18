import type { D1Database } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import { assignRoleToUser } from "@/db/queries/rbac";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

const mockGetSession = vi.fn();

vi.mock("@/lib/auth", () => ({
	getAuth: vi.fn(async () => ({
		api: { getSession: mockGetSession },
	})),
}));

const testDb = createTestDb();

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(async () => ({} as D1Database)),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: vi.fn(() => testDb),
	};
});

import { getSessionFromHeaders, requireSession } from "@/lib/rbac";

describe("require-session", () => {
	beforeEach(() => {
		mockGetSession.mockReset();
	});

	it("getSessionFromHeaders returns null without auth headers", async () => {
		mockGetSession.mockResolvedValue(null);
		await expect(getSessionFromHeaders(new Headers())).resolves.toBeNull();
	});

	it("requireSession returns 401 without session", async () => {
		mockGetSession.mockResolvedValue(null);
		await expect(requireSession(new Headers())).rejects.toMatchObject({
			status: 401,
		});
	});

	it("requireSession returns 401 when user lacks app:use", async () => {
		const userId = createId();
		await testDb.insert(schema.user).values({
			id: userId,
			name: "No Role",
			email: "norole@aluno.ifsc.edu.br",
			emailVerified: true,
		});

		mockGetSession.mockResolvedValue({ user: { id: userId } });

		await expect(requireSession(new Headers())).rejects.toMatchObject({
			status: 401,
		});
	});

	it("requireSession returns session when user has app:use", async () => {
		const userId = createId();
		await testDb.insert(schema.user).values({
			id: userId,
			name: "User",
			email: "user@aluno.ifsc.edu.br",
			emailVerified: true,
		});
		await assignRoleToUser(testDb, userId, "user");

		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const session = await requireSession(new Headers());
		expect(session.user.id).toBe(userId);
	});
});
