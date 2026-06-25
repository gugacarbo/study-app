import { z } from "zod";

export const setUserRoleSchema = z.object({
	userId: z.string().uuid(),
	roleKey: z.enum(["user", "admin", "super_admin"]),
	action: z.enum(["add", "remove"]),
});

export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
