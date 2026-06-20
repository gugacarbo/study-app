import {
	index,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const roles = sqliteTable(
	"roles",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		name: text("name").notNull(),
	},
	(table) => [uniqueIndex("uq_roles_key").on(table.key)],
);

export const permissions = sqliteTable(
	"permissions",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		description: text("description"),
	},
	(table) => [uniqueIndex("uq_permissions_key").on(table.key)],
);

export const rolePermissions = sqliteTable(
	"role_permissions",
	{
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		permissionId: text("permission_id")
			.notNull()
			.references(() => permissions.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("idx_role_permissions_permission_id").on(table.permissionId),
	],
);

export const userRoles = sqliteTable(
	"user_roles",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.roleId] }),
		index("idx_user_roles_role_id").on(table.roleId),
	],
);
