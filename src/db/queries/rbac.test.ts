import { describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import {
	assignRoleToUser,
	getUserPermissionKeys,
	userHasPermission,
} from "@/db/queries/rbac";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

describe("rbac", () => {
	it("migration seeds rbac catalog", async () => {
		const db = createTestDb();
		const roleKeys = (await db.select().from(schema.roles)).map((row) => row.key);
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
});
