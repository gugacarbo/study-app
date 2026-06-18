import { eq } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type UserWithRoles = {
	id: string;
	email: string;
	roles: string[];
};

export async function listUsersWithRoles(
	db: AppDatabase,
): Promise<UserWithRoles[]> {
	const users = await db
		.select({ id: schema.user.id, email: schema.user.email })
		.from(schema.user);

	const roleRows = await db
		.select({
			userId: schema.userRoles.userId,
			roleKey: schema.roles.key,
		})
		.from(schema.userRoles)
		.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id));

	const rolesByUser = new Map<string, string[]>();
	for (const row of roleRows) {
		const existing = rolesByUser.get(row.userId) ?? [];
		existing.push(row.roleKey);
		rolesByUser.set(row.userId, existing);
	}

	return users.map((user) => ({
		id: user.id,
		email: user.email,
		roles: rolesByUser.get(user.id) ?? [],
	}));
}
