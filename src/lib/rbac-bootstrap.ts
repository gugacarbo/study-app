import type { AppDatabase } from "@/db/client";
import { assignRoleToUser, ROLE_ADMIN, ROLE_USER, seedRbacIfEmpty } from "@/db/queries/rbac";
import { parseAdminEmails } from "@/env";

export async function bootstrapUserRoles(
	db: AppDatabase,
	email: string,
	userId: string,
	adminEmailsRaw: string,
) {
	await seedRbacIfEmpty(db);
	await assignRoleToUser(db, userId, ROLE_USER);

	const normalizedEmail = email.trim().toLowerCase();
	if (parseAdminEmails(adminEmailsRaw).has(normalizedEmail)) {
		await assignRoleToUser(db, userId, ROLE_ADMIN);
	}
}
