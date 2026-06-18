import { createDb } from "@/db/client";
import { PERM_ADMIN_ACCESS, userHasPermission } from "@/db/queries/rbac";
import { requireDB } from "@/functions/db";
import { getAuth } from "@/lib/auth";

export async function getSessionFromHeaders(headers: Headers) {
	const auth = await getAuth();
	return auth.api.getSession({ headers });
}

export async function requireSession(headers: Headers) {
	const session = await getSessionFromHeaders(headers);
	if (!session?.user?.id) {
		throw new Response("Unauthorized", { status: 401 });
	}
	return session;
}

export async function requireAdminSession(headers: Headers) {
	const session = await requireSession(headers);
	const d1 = await requireDB();
	const db = createDb(d1);
	const allowed = await userHasPermission(
		db,
		session.user.id,
		PERM_ADMIN_ACCESS,
	);
	if (!allowed) {
		throw new Response("Not Found", { status: 404 });
	}
	return session;
}

export async function hasPermission(
	userId: string,
	permissionKey: string,
): Promise<boolean> {
	const d1 = await requireDB();
	const db = createDb(d1);
	return userHasPermission(db, userId, permissionKey);
}
