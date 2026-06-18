import { describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import { getUserRoleKeys } from "@/db/queries/rbac";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { bootstrapUserRoles } from "@/lib/rbac-bootstrap";

describe("rbac-bootstrap", () => {
	it("assigns admin role when email is in ADMIN_EMAILS", async () => {
		const db = createTestDb();
		const userId = createId();
		await db.insert(schema.user).values({
			id: userId,
			name: "Admin",
			email: "boss@aluno.ifsc.edu.br",
			emailVerified: true,
		});

		await bootstrapUserRoles(db, "boss@aluno.ifsc.edu.br", userId, "boss@aluno.ifsc.edu.br");
		const roles = await getUserRoleKeys(db, userId);
		expect(roles).toContain("user");
		expect(roles).toContain("admin");
	});
});
