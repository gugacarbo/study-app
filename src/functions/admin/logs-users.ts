import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";
import * as schema from "@/db/schema";

export const getLogsUsers = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequest().headers;
	await requireAdminSession(headers);
	const db = createDb(await requireDB());

	const rows = await db
		.select({
			id: schema.user.id,
			email: schema.user.email,
		})
		.from(schema.user)
		.orderBy(schema.user.email);

	return rows;
});
