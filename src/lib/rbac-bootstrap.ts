import type { AppDatabase } from "@/db/client";
import {
	assignRoleToUser,
	ROLE_SUPER_ADMIN,
	ROLE_USER,
	seedRbacIfEmpty,
} from "@/db/queries/rbac";

export async function bootstrapUserRoles(
	db: AppDatabase,
	email: string,
	userId: string,
	adminEmail: string,
) {
	await seedRbacIfEmpty(db);
	await assignRoleToUser(db, userId, ROLE_USER);

	const normalizedEmail = email.trim().toLowerCase();
	if (normalizedEmail === adminEmail.trim().toLowerCase()) {
		await assignRoleToUser(db, userId, ROLE_SUPER_ADMIN);
	}
}
