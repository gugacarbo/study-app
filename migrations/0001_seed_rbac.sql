-- RBAC v1 seed (SPEC-0001 / ADR-0004) — ids match src/db/seed/rbac-v1.ts
INSERT OR IGNORE INTO `roles` (`id`, `key`, `name`) VALUES
	('f47ac10b-58cc-4372-a567-0e02b2c3d401', 'user', 'User'),
	('f47ac10b-58cc-4372-a567-0e02b2c3d402', 'admin', 'Admin');
--> statement-breakpoint
INSERT OR IGNORE INTO `permissions` (`id`, `key`, `description`) VALUES
	('f47ac10b-58cc-4372-a567-0e02b2c3d411', 'app:use', 'Use the app'),
	('f47ac10b-58cc-4372-a567-0e02b2c3d412', 'admin:access', 'Access admin routes');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
	(r.key = 'user' AND p.key = 'app:use')
	OR (r.key = 'admin' AND p.key IN ('app:use', 'admin:access'))
);
