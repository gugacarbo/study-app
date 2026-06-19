import type { D1Database } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import { createDb } from "@/db/client";
import { authSchema } from "@/db/schema";
import { env, serverEnvFrom } from "@/env";
import { isAllowedSignupEmail } from "@/lib/auth-allowed-email-domain";
import { authLog, sendMagicLinkEmail } from "@/lib/auth-magic-link-email";
import { bootstrapUserRoles } from "@/lib/rbac-bootstrap";

export type AuthBindings = {
	DB: D1Database;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	ALLOWED_SIGNUP_EMAIL_DOMAINS: string;
	EMAIL_FROM_ADDRESS: string;
	EMAIL_FROM_NAME: string;
	ADMIN_EMAILS: string;
	RESEND_API_KEY?: string;
};

/** Loopback origins used by Vite (:3000) and Localflare (:8787 attach / :8788). */
const LOCAL_DEV_TRUSTED_ORIGINS = [
	"http://localhost:3000",
	"http://localhost:8787",
	"http://localhost:8788",
	"http://127.0.0.1:3000",
	"http://127.0.0.1:8787",
	"http://127.0.0.1:8788",
] as const;

function getLocalDevTrustedOrigins(baseUrl: string): string[] | undefined {
	try {
		const { hostname } = new URL(baseUrl);
		if (hostname !== "localhost" && hostname !== "127.0.0.1") {
			return undefined;
		}
	} catch {
		return undefined;
	}
	return [...LOCAL_DEV_TRUSTED_ORIGINS];
}

function toAuthBindings(
	db: D1Database,
	source: Record<string, unknown>,
): AuthBindings {
	const validated = serverEnvFrom(source);

	if (!validated.BETTER_AUTH_SECRET || !validated.BETTER_AUTH_URL) {
		throw new Error("Auth bindings are not available");
	}

	return {
		DB: db,
		BETTER_AUTH_SECRET: validated.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: validated.BETTER_AUTH_URL,
		ALLOWED_SIGNUP_EMAIL_DOMAINS: validated.ALLOWED_SIGNUP_EMAIL_DOMAINS,
		EMAIL_FROM_ADDRESS: validated.EMAIL_FROM_ADDRESS,
		EMAIL_FROM_NAME: validated.EMAIL_FROM_NAME,
		ADMIN_EMAILS: validated.ADMIN_EMAILS,
		RESEND_API_KEY: validated.RESEND_API_KEY,
	};
}

export function createAuth(authBindings: AuthBindings) {
	const db = drizzle(authBindings.DB, { schema: authSchema });
	const appDb = createDb(authBindings.DB);
	const allowedDomains = authBindings.ALLOWED_SIGNUP_EMAIL_DOMAINS;

	const trustedOrigins = getLocalDevTrustedOrigins(
		authBindings.BETTER_AUTH_URL,
	);

	return betterAuth({
		secret: authBindings.BETTER_AUTH_SECRET,
		baseURL: authBindings.BETTER_AUTH_URL,
		...(trustedOrigins ? { trustedOrigins } : {}),
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema: authSchema,
		}),
		databaseHooks: {
			user: {
				create: {
					after: async (createdUser) => {
						await bootstrapUserRoles(
							appDb,
							createdUser.email,
							createdUser.id,
							authBindings.ADMIN_EMAILS,
						);
					},
				},
			},
		},
		plugins: [
			magicLink({
				expiresIn: 600,
				sendMagicLink: async ({ email, url }) => {
					if (!isAllowedSignupEmail(email, allowedDomains)) {
						authLog("magic link rejected (email not allowed)", {
							email,
							allowedDomains,
						});
						throw new APIError("BAD_REQUEST", {
							message: "Este email não está autorizado",
						});
					}
					authLog("magic link requested", {
						email,
						resendConfigured: Boolean(authBindings.RESEND_API_KEY),
					});
					await sendMagicLinkEmail(authBindings, email, url);
				},
			}),
			tanstackStartCookies(),
		],
	});
}

export type AppAuth = ReturnType<typeof createAuth>;

let cachedAuthEnv: AuthBindings | null = null;
let cachedAuth: AppAuth | null = null;
const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

export async function getAuthBindings(): Promise<AuthBindings> {
	if (cachedAuthEnv) return cachedAuthEnv;

	try {
		const mod = (await import(
			/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE
		)) as unknown as { env: Record<string, unknown> & { DB: D1Database } };
		cachedAuthEnv = toAuthBindings(mod.env.DB, mod.env);
		return cachedAuthEnv;
	} catch {
		cachedAuthEnv = toAuthBindings(
			undefined as unknown as D1Database,
			env as unknown as Record<string, unknown>,
		);
		return cachedAuthEnv;
	}
}

export async function getAuth(): Promise<AppAuth> {
	if (cachedAuth) return cachedAuth;
	const authBindings = await getAuthBindings();
	cachedAuth = createAuth(authBindings);
	return cachedAuth;
}

export function createAuthFromBindings(authBindings: AuthBindings): AppAuth {
	return createAuth(authBindings);
}

export async function getAllowedSignupEmailDomains(): Promise<string> {
	const bindings = await getAuthBindings();
	return bindings.ALLOWED_SIGNUP_EMAIL_DOMAINS;
}
