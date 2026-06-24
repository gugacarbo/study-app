import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "@/db/client";
import {
	assignRoleToUser,
	countUsersWithRole,
	getUserRoleKeys,
	isSeedRole,
	ROLE_ADMIN,
	ROLE_USER,
	removeRoleFromUser,
} from "@/db/queries/rbac";
import { listUsersWithRoles } from "@/db/queries/users";
import * as schema from "@/db/schema";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";

const setUserRoleSchema = z.object({
	userId: z.string().uuid(),
	roleKey: z.string(),
	action: z.enum(["add", "remove"]),
});

export async function listUsersHandler(headers: Headers) {
	await requireAdminSession(headers);
	const db = createDb(await requireDB());
	return listUsersWithRoles(db);
}

export async function setUserRoleHandler(
	input: z.infer<typeof setUserRoleSchema>,
	headers: Headers,
) {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());

	if (!isSeedRole(input.roleKey)) {
		throw new Response("Invalid role", { status: 400 });
	}

	const target = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(eq(schema.user.id, input.userId))
		.limit(1);
	if (!target[0]) throw new Response("Not Found", { status: 404 });

	if (
		input.action === "remove" &&
		input.roleKey === ROLE_ADMIN &&
		input.userId === session.user.id
	) {
		throw new Response("Cannot remove admin role from your own account", {
			status: 400,
		});
	}

	if (
		input.action === "remove" &&
		input.roleKey === ROLE_ADMIN &&
		(await countUsersWithRole(db, ROLE_ADMIN)) <= 1
	) {
		throw new Response("Cannot remove the last admin", { status: 400 });
	}

	if (input.action === "add") {
		await assignRoleToUser(db, input.userId, input.roleKey);
		return;
	}

	const rolesBefore = await getUserRoleKeys(db, input.userId);
	await removeRoleFromUser(db, input.userId, input.roleKey);
	if (
		input.roleKey === ROLE_ADMIN &&
		!rolesBefore.includes(ROLE_USER)
	) {
		await assignRoleToUser(db, input.userId, ROLE_USER);
	}
}

export const listUsers = createServerFn({ method: "GET" }).handler(async () =>
	listUsersHandler(getRequest().headers),
);

export const setUserRole = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => {
		const result = setUserRoleSchema.safeParse(data);
		if (!result.success) {
			throw new Response(JSON.stringify(result.error.flatten()), {
				status: 400,
			});
		}
		return result.data;
	})
	.handler(async ({ data }) => setUserRoleHandler(data, getRequest().headers));
