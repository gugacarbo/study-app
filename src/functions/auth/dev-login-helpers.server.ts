import { setCookie } from "@tanstack/react-start/server";
import { and, eq, gt } from "drizzle-orm";
import { createDb } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import { session as sessionTable, user as userTable } from "@/db/schema";
import { requireDB } from "@/functions/db";
import type { AuthBindings } from "@/lib/auth";
import { isAllowedSignupEmail } from "@/lib/auth-allowed-email-domain";
import {
	DEFAULT_DEV_ADMIN_EMAIL,
	DEFAULT_DEV_ADMIN_NAME,
} from "@/lib/dev-auth";
import { bootstrapUserRoles } from "@/lib/rbac-bootstrap";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function assertDevelopmentOnly(nodeEnv: AuthBindings["NODE_ENV"]) {
	if (nodeEnv !== "development") {
		throw new Response("Not Found", { status: 404 });
	}
}

function getSessionCookieName(baseUrl: string) {
	const secure = baseUrl.startsWith("https://");
	return `${secure ? "__Secure-" : ""}better-auth.session_token`;
}

async function signSessionTokenValue(token: string, secret: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(token),
	);
	const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
	return `${token}.${signatureB64}`;
}

export async function setSessionCookie(
	authBindings: AuthBindings,
	token: string,
) {
	const cookieName = getSessionCookieName(authBindings.BETTER_AUTH_URL);
	const secure = authBindings.BETTER_AUTH_URL.startsWith("https://");
	const cookieValue = await signSessionTokenValue(
		token,
		authBindings.BETTER_AUTH_SECRET,
	);

	setCookie(cookieName, cookieValue, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure,
		maxAge: SESSION_MAX_AGE_SECONDS,
	});
}

function getFallbackDevName(email: string) {
	const localPart = email.split("@")[0]?.trim();
	return localPart && localPart.length > 0 ? localPart : "Dev User";
}

export async function ensureDevSessionForEmail(
	authBindings: AuthBindings,
	email: string,
	fallbackName = getFallbackDevName(email),
) {
	assertDevelopmentOnly(authBindings.NODE_ENV);

	const normalizedEmail = email.trim().toLowerCase();
	if (
		!isAllowedSignupEmail(
			normalizedEmail,
			authBindings.ALLOWED_SIGNUP_EMAIL_DOMAINS,
		)
	) {
		throw new Error("Este email não está autorizado");
	}

	const db = createDb(await requireDB());
	const now = new Date();

	const existingUser = await db
		.select({
			id: userTable.id,
			name: userTable.name,
			emailVerified: userTable.emailVerified,
		})
		.from(userTable)
		.where(eq(userTable.email, normalizedEmail))
		.limit(1);

	let userId = existingUser[0]?.id;

	if (!userId) {
		userId = createId();
		await db.insert(userTable).values({
			id: userId,
			name: fallbackName,
			email: normalizedEmail,
			emailVerified: true,
		});
	} else if (!existingUser[0]?.emailVerified || !existingUser[0]?.name.trim()) {
		await db
			.update(userTable)
			.set({
				name: existingUser[0]?.name.trim() || fallbackName,
				emailVerified: true,
				updatedAt: now,
			})
			.where(eq(userTable.id, userId));
	}

	await bootstrapUserRoles(
		db,
		normalizedEmail,
		userId,
		authBindings.ADMIN_EMAILS,
	);

	const validSession = await db
		.select({ token: sessionTable.token })
		.from(sessionTable)
		.where(
			and(eq(sessionTable.userId, userId), gt(sessionTable.expiresAt, now)),
		)
		.limit(1);

	const token = validSession[0]?.token ?? createId();

	if (!validSession[0]) {
		await db.insert(sessionTable).values({
			id: createId(),
			expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
			token,
			userId,
			ipAddress: "127.0.0.1",
			userAgent: "dev-auto-login",
		});
	}

	await setSessionCookie(authBindings, token);

	return {
		ok: true as const,
		email: normalizedEmail,
		userId,
	};
}

export async function ensureDevAdminSession(authBindings: AuthBindings) {
	return ensureDevSessionForEmail(
		authBindings,
		DEFAULT_DEV_ADMIN_EMAIL,
		DEFAULT_DEV_ADMIN_NAME,
	);
}
