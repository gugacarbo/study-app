import { setCookie } from "@tanstack/react-start/server";
import { and, eq, gt } from "drizzle-orm";
import { createDb } from "@/db/client";
import { session as sessionTable } from "@/db/schema";
import { requireDB } from "@/functions/db";
import { getAuthBindings } from "@/lib/auth";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function assertDevOnly() {
	if (process.env.NODE_ENV === "production") {
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
	return encodeURIComponent(`${token}.${signatureB64}`);
}

export async function devLoginWithTokenHandler(token: string) {
	assertDevOnly();

	const authBindings = await getAuthBindings();
	const db = createDb(await requireDB());
	const now = new Date();

	const rows = await db
		.select({ token: sessionTable.token })
		.from(sessionTable)
		.where(and(eq(sessionTable.token, token), gt(sessionTable.expiresAt, now)))
		.limit(1);

	const cookieName = getSessionCookieName(authBindings.BETTER_AUTH_URL);
	const secure = authBindings.BETTER_AUTH_URL.startsWith("https://");
	const cookieValue = rows[0]
		? await signSessionTokenValue(
				rows[0].token,
				authBindings.BETTER_AUTH_SECRET,
			)
		: token;

	setCookie(cookieName, cookieValue, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure,
		maxAge: SESSION_MAX_AGE_SECONDS,
	});

	return { ok: true as const };
}
