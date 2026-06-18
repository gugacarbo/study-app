import { describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-db";
import * as schema from "@/db/schema";
import {
	assignRoleToUser,
	getUserPermissionKeys,
	seedRbacIfEmpty,
	userHasPermission,
} from "@/db/queries/rbac";
import { createId } from "@/db/queries/helpers";

describe("rbac", () => {
	it("seeds roles and permissions", async () => {
		const db = createTestDb();
		await seedRbacIfEmpty(db);

		const userId = createId();
		await db.insert(schema.user).values({
			id: userId,
			name: "Test",
			email: "test@ifsc.edu.br",
			emailVerified: true,
		});

		await assignRoleToUser(db, userId, "user");
		const permissions = await getUserPermissionKeys(db, userId);
		expect(permissions).toContain("app:use");
		expect(await userHasPermission(db, userId, "admin:access")).toBe(false);
	});

	it("admin role includes admin:access", async () => {
		const db = createTestDb();
		await seedRbacIfEmpty(db);

		const userId = createId();
		await db.insert(schema.user).values({
			id: userId,
			name: "Admin",
			email: "admin@ifsc.edu.br",
			emailVerified: true,
		});

		await assignRoleToUser(db, userId, "admin");
		expect(await userHasPermission(db, userId, "admin:access")).toBe(true);
	});
});
