import type { D1Database } from "@cloudflare/workers-types";
import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import { assignRoleToUser, userHasPermission } from "@/db/queries/rbac";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { listUsersHandler, setUserRoleHandler } from "@/functions/admin/users";

const mockRequireAdminSession = vi.fn();
const mockCreateDb = vi.fn<() => AppDatabase>();

vi.mock("@/lib/rbac", () => ({
	requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

const testDb = createTestDb();
mockCreateDb.mockReturnValue(testDb);

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(async () => ({}) as D1Database),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: () => mockCreateDb(),
	};
});

async function insertUser(db: AppDatabase, id = createId()) {
	const email = `user-${id}@aluno.ifsc.edu.br`;
	await db.insert(schema.user).values({
		id,
		name: "User",
		email,
		emailVerified: true,
	});
	return { id, email };
}

describe("admin users", () => {
	beforeEach(() => {
		mockRequireAdminSession.mockReset();
		mockCreateDb.mockReturnValue(testDb);
	});

	it("listUsers returns id, email, and roles", async () => {
		const adminId = createId();
		const target = await insertUser(testDb);

		await insertUser(testDb, adminId);
		await assignRoleToUser(testDb, adminId, "admin");
		await assignRoleToUser(testDb, target.id, "user");

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });

		const users = await listUsersHandler(new Headers());
		expect(users.find((user) => user.id === target.id)).toEqual({
			id: target.id,
			email: target.email,
			roles: ["user"],
		});
	});

	it("setUserRole add assigns role to target user", async () => {
		const adminId = createId();
		const target = await insertUser(testDb);

		await insertUser(testDb, adminId);
		await assignRoleToUser(testDb, adminId, "admin");
		await assignRoleToUser(testDb, target.id, "user");

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });
		await setUserRoleHandler(
			{ userId: target.id, roleKey: "admin", action: "add" },
			new Headers(),
		);

		expect(await userHasPermission(testDb, target.id, "admin:access")).toBe(
			true,
		);
	});

	it("setUserRole remove drops role from target user", async () => {
		const isolatedDb = createTestDb();
		mockCreateDb.mockReturnValue(isolatedDb);

		const adminId = createId();
		const target = await insertUser(isolatedDb);

		await insertUser(isolatedDb, adminId);
		await assignRoleToUser(isolatedDb, adminId, "admin");
		await assignRoleToUser(isolatedDb, target.id, "admin");

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });
		await setUserRoleHandler(
			{ userId: target.id, roleKey: "admin", action: "remove" },
			new Headers(),
		);

		expect(await userHasPermission(isolatedDb, target.id, "admin:access")).toBe(
			false,
		);
		await expect(
			isolatedDb
				.select({ count: count() })
				.from(schema.userRoles)
				.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
				.where(eq(schema.roles.key, "user")),
		).resolves.toEqual([{ count: 1 }]);
	});

	it("setUserRole rejects role outside seed catalog", async () => {
		const target = await insertUser(testDb);
		mockRequireAdminSession.mockResolvedValue({ user: { id: createId() } });

		await expect(
			setUserRoleHandler(
				{ userId: target.id, roleKey: "superadmin", action: "add" },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it("setUserRole returns 404 for missing target user", async () => {
		mockRequireAdminSession.mockResolvedValue({ user: { id: createId() } });

		await expect(
			setUserRoleHandler(
				{ userId: createId(), roleKey: "user", action: "add" },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 404 });
	});

	it("setUserRole blocks last admin from removing own admin role", async () => {
		const isolatedDb = createTestDb();
		mockCreateDb.mockReturnValue(isolatedDb);

		const adminId = createId();
		await insertUser(isolatedDb, adminId);
		await assignRoleToUser(isolatedDb, adminId, "admin");

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });

		await expect(
			setUserRoleHandler(
				{ userId: adminId, roleKey: "admin", action: "remove" },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it("setUserRole blocks removing admin role from own account even if another admin exists", async () => {
		const adminId = createId();
		const otherAdminId = createId();
		await insertUser(testDb, adminId);
		await insertUser(testDb, otherAdminId);
		await assignRoleToUser(testDb, adminId, "admin");
		await assignRoleToUser(testDb, otherAdminId, "admin");

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });

		await expect(
			setUserRoleHandler(
				{ userId: adminId, roleKey: "admin", action: "remove" },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it("setUserRole adds user role when removing admin from a user with only admin", async () => {
		const adminId = createId();
		const target = await insertUser(testDb);

		await insertUser(testDb, adminId);
		await assignRoleToUser(testDb, adminId, "admin");
		await assignRoleToUser(testDb, target.id, "admin");

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });
		await setUserRoleHandler(
			{ userId: target.id, roleKey: "admin", action: "remove" },
			new Headers(),
		);

		expect(await userHasPermission(testDb, target.id, "admin:access")).toBe(
			false,
		);
		expect(await userHasPermission(testDb, target.id, "app:use")).toBe(true);
	});
});
