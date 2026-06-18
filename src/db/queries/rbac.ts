import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { createId } from "./helpers";
import * as schema from "../schema";

const ROLE_USER = "user";
const ROLE_ADMIN = "admin";
const PERM_APP_USE = "app:use";
const PERM_ADMIN_ACCESS = "admin:access";

export async function seedRbacIfEmpty(db: AppDatabase) {
	const existing = await db.select().from(schema.roles).limit(1);
	if (existing.length > 0) return;

	const userRoleId = createId();
	const adminRoleId = createId();
	const appUseId = createId();
	const adminAccessId = createId();

	await db.insert(schema.roles).values([
		{ id: userRoleId, key: ROLE_USER, name: "User" },
		{ id: adminRoleId, key: ROLE_ADMIN, name: "Admin" },
	]);
	await db.insert(schema.permissions).values([
		{ id: appUseId, key: PERM_APP_USE, description: "Use the app" },
		{
			id: adminAccessId,
			key: PERM_ADMIN_ACCESS,
			description: "Access admin routes",
		},
	]);
	await db.insert(schema.rolePermissions).values([
		{ roleId: userRoleId, permissionId: appUseId },
		{ roleId: adminRoleId, permissionId: appUseId },
		{ roleId: adminRoleId, permissionId: adminAccessId },
	]);
}

export async function assignRoleToUser(
	db: AppDatabase,
	userId: string,
	roleKey: string,
) {
	const role = await db
		.select()
		.from(schema.roles)
		.where(eq(schema.roles.key, roleKey))
		.limit(1);
	const found = role[0];
	if (!found) {
		throw new Error(`Role not found: ${roleKey}`);
	}

	await db
		.insert(schema.userRoles)
		.values({ userId, roleId: found.id })
		.onConflictDoNothing();
}

export async function getUserRoleKeys(
	db: AppDatabase,
	userId: string,
): Promise<string[]> {
	const rows = await db
		.select({ key: schema.roles.key })
		.from(schema.userRoles)
		.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
		.where(eq(schema.userRoles.userId, userId));
	return rows.map((row) => row.key);
}

export async function getUserPermissionKeys(
	db: AppDatabase,
	userId: string,
): Promise<string[]> {
	const roleRows = await db
		.select({ roleId: schema.userRoles.roleId })
		.from(schema.userRoles)
		.where(eq(schema.userRoles.userId, userId));
	const roleIds = roleRows.map((row) => row.roleId);
	if (roleIds.length === 0) return [];

	const rows = await db
		.select({ key: schema.permissions.key })
		.from(schema.rolePermissions)
		.innerJoin(
			schema.permissions,
			eq(schema.rolePermissions.permissionId, schema.permissions.id),
		)
		.where(inArray(schema.rolePermissions.roleId, roleIds));
	return [...new Set(rows.map((row) => row.key))];
}

export async function userHasPermission(
	db: AppDatabase,
	userId: string,
	permissionKey: string,
): Promise<boolean> {
	const permissions = await getUserPermissionKeys(db, userId);
	return permissions.includes(permissionKey);
}

export { ROLE_ADMIN, ROLE_USER, PERM_ADMIN_ACCESS, PERM_APP_USE };
