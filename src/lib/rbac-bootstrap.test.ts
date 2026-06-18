import { describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-db";
import * as schema from "@/db/schema";
import { bootstrapUserRoles } from "@/lib/rbac-bootstrap";
import { getUserRoleKeys } from "@/db/queries/rbac";
import { createId } from "@/db/queries/helpers";

describe("rbac-bootstrap", () => {
	it("assigns admin role when email is in ADMIN_EMAILS", async () => {
		const db = createTestDb();
		const userId = createId();
		await db.insert(schema.user).values({
			id: userId,
			name: "Admin",
			email: "boss@ifsc.edu.br",
			emailVerified: true,
		});

		await bootstrapUserRoles(db, "boss@ifsc.edu.br", userId, "boss@ifsc.edu.br");
		const roles = await getUserRoleKeys(db, userId);
		expect(roles).toContain("user");
		expect(roles).toContain("admin");
	});
});
