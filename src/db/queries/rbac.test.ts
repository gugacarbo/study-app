import { describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import {
	assignRoleToUser,
	countUsersWithRole,
	getUserPermissionKeys,
	isSeedRole,
	removeRoleFromUser,
	userHasPermission,
} from "@/db/queries/rbac";
import { listUsersWithRoles } from "@/db/queries/users";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

describe("rbac", () => {
	it("migration seeds rbac catalog", async () => {
		const db = createTestDb();
		const roleKeys = (await db.select().from(schema.roles)).map(
			(row) => row.key,
		);
		expect(roleKeys).toContain("user");
		expect(roleKeys).toContain("admin");

		const permissionKeys = (await db.select().from(schema.permissions)).map(
			(row) => row.key,
		);
		expect(permissionKeys).toContain("app:use");
		expect(permissionKeys).toContain("admin:access");
	});

	it("assigns user role permissions from seeded catalog", async () => {
		const db = createTestDb();

		const userId = createId();
		await db.insert(schema.user).values({
			id: userId,
			name: "Test",
			email: "test@aluno.ifsc.edu.br",
			emailVerified: true,
		});

		await assignRoleToUser(db, userId, "user");
		const permissions = await getUserPermissionKeys(db, userId);
		expect(permissions).toContain("app:use");
		expect(await userHasPermission(db, userId, "admin:access")).toBe(false);
	});

	it("admin role includes admin:access", async () => {
		const db = createTestDb();

		const userId = createId();
		await db.insert(schema.user).values({
			id: userId,
			name: "Admin",
			email: "admin@aluno.ifsc.edu.br",
			emailVerified: true,
		});

		await assignRoleToUser(db, userId, "admin");
		expect(await userHasPermission(db, userId, "admin:access")).toBe(true);
	});

	it("isSeedRole accepts user and admin only", () => {
		expect(isSeedRole("user")).toBe(true);
		expect(isSeedRole("admin")).toBe(true);
		expect(isSeedRole("superadmin")).toBe(false);
	});

	it("removeRoleFromUser deletes assignment", async () => {
		const db = createTestDb();
		const userId = createId();

		await db.insert(schema.user).values({
			id: userId,
			name: "U",
			email: "u@aluno.ifsc.edu.br",
			emailVerified: true,
		});

		await assignRoleToUser(db, userId, "admin");
		expect(await countUsersWithRole(db, "admin")).toBe(1);

		await removeRoleFromUser(db, userId, "admin");
		expect(await countUsersWithRole(db, "admin")).toBe(0);
		expect(await userHasPermission(db, userId, "admin:access")).toBe(false);
	});

	it("countUsersWithRole counts distinct users", async () => {
		const db = createTestDb();
		const adminA = createId();
		const adminB = createId();

		await db.insert(schema.user).values([
			{
				id: adminA,
				name: "A",
				email: "a@aluno.ifsc.edu.br",
				emailVerified: true,
			},
			{
				id: adminB,
				name: "B",
				email: "b@aluno.ifsc.edu.br",
				emailVerified: true,
			},
		]);

		await assignRoleToUser(db, adminA, "admin");
		await assignRoleToUser(db, adminB, "admin");

		expect(await countUsersWithRole(db, "admin")).toBe(2);
	});

	it("listUsersWithRoles returns email and role keys", async () => {
		const db = createTestDb();
		const userId = createId();

		await db.insert(schema.user).values({
			id: userId,
			name: "U",
			email: "u@aluno.ifsc.edu.br",
			emailVerified: true,
		});
		await assignRoleToUser(db, userId, "user");
		await assignRoleToUser(db, userId, "admin");

		const users = await listUsersWithRoles(db);
		const row = users.find((user) => user.id === userId);
		expect(row?.email).toBe("u@aluno.ifsc.edu.br");
		expect(row?.roles.sort()).toEqual(["admin", "user"]);
	});
});
