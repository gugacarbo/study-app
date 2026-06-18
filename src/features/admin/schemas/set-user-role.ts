import { z } from "zod";

export const setUserRoleSchema = z.object({
	userId: z.string().uuid(),
	roleKey: z.enum(["user", "admin"]),
	action: z.enum(["add", "remove"]),
});

export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
