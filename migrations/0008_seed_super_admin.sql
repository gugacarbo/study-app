-- super_admin role + super_admin:access permission
INSERT OR IGNORE INTO `roles` (`id`, `key`, `name`) VALUES
	('f47ac10b-58cc-4372-a567-0e02b2c3d403', 'super_admin', 'Super Admin');
--> statement-breakpoint
INSERT OR IGNORE INTO `permissions` (`id`, `key`, `description`) VALUES
	('f47ac10b-58cc-4372-a567-0e02b2c3d413', 'super_admin:access', 'Access super admin features');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
	(r.key = 'super_admin' AND p.key IN ('app:use', 'admin:access', 'super_admin:access'))
);
