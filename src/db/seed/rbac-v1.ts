/**
 * RBAC v1 catalog — fixed UUIDs seeded in migrations/0001_seed_rbac.sql (SPEC-0001).
 * Runtime seedRbacIfEmpty uses the same ids for idempotent fallback (tests, pre-migrate dev).
 */
export const RBAC_V1_ROLE_IDS = {
	user: "f47ac10b-58cc-4372-a567-0e02b2c3d401",
	admin: "f47ac10b-58cc-4372-a567-0e02b2c3d402",
} as const;

export const RBAC_V1_PERMISSION_IDS = {
	appUse: "f47ac10b-58cc-4372-a567-0e02b2c3d411",
	adminAccess: "f47ac10b-58cc-4372-a567-0e02b2c3d412",
} as const;

export const RBAC_V1_ROLE_ROWS = [
	{ id: RBAC_V1_ROLE_IDS.user, key: "user", name: "User" },
	{ id: RBAC_V1_ROLE_IDS.admin, key: "admin", name: "Admin" },
] as const;

export const RBAC_V1_PERMISSION_ROWS = [
	{
		id: RBAC_V1_PERMISSION_IDS.appUse,
		key: "app:use",
		description: "Use the app",
	},
	{
		id: RBAC_V1_PERMISSION_IDS.adminAccess,
		key: "admin:access",
		description: "Access admin routes",
	},
] as const;

export const RBAC_V1_ROLE_PERMISSION_ROWS = [
	{
		roleId: RBAC_V1_ROLE_IDS.user,
		permissionId: RBAC_V1_PERMISSION_IDS.appUse,
	},
	{
		roleId: RBAC_V1_ROLE_IDS.admin,
		permissionId: RBAC_V1_PERMISSION_IDS.appUse,
	},
	{
		roleId: RBAC_V1_ROLE_IDS.admin,
		permissionId: RBAC_V1_PERMISSION_IDS.adminAccess,
	},
] as const;
