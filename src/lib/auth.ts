import type { D1Database } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import { env as appEnv } from "@/env";
import { createDb } from "@/db/client";
import { authSchema } from "@/db/schema";
import { isAllowedSignupEmail } from "@/lib/auth-allowed-email-domain";
import { authLog, sendMagicLinkEmail } from "@/lib/auth-magic-link-email";
import { bootstrapUserRoles } from "@/lib/rbac-bootstrap";

export type AuthBindings = {
	DB: D1Database;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	ALLOWED_SIGNUP_EMAIL_DOMAINS?: string;
	EMAIL_FROM_ADDRESS?: string;
	EMAIL_FROM_NAME?: string;
	ADMIN_EMAILS?: string;
	RESEND_API_KEY?: string;
};

export function createAuth(env: AuthBindings) {
	const db = drizzle(env.DB, { schema: authSchema });
	const appDb = createDb(env.DB);
	const allowedDomains =
		env.ALLOWED_SIGNUP_EMAIL_DOMAINS ?? appEnv.ALLOWED_SIGNUP_EMAIL_DOMAINS;

	return betterAuth({
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
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
							env.ADMIN_EMAILS ?? "",
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
						resendConfigured: Boolean(env.RESEND_API_KEY),
					});
					await sendMagicLinkEmail(env, email, url);
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
		)) as unknown as { env: AuthBindings };
		cachedAuthEnv = mod.env;
		return mod.env;
	} catch {
		const secret = process.env.BETTER_AUTH_SECRET;
		const baseURL = process.env.BETTER_AUTH_URL;
		if (!secret || !baseURL) {
			throw new Error("Auth bindings are not available");
		}
		cachedAuthEnv = {
			DB: undefined as unknown as D1Database,
			BETTER_AUTH_SECRET: secret,
			BETTER_AUTH_URL: baseURL,
			ALLOWED_SIGNUP_EMAIL_DOMAINS: appEnv.ALLOWED_SIGNUP_EMAIL_DOMAINS,
			EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
			EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
			ADMIN_EMAILS: process.env.ADMIN_EMAILS,
			RESEND_API_KEY: process.env.RESEND_API_KEY,
		};
		return cachedAuthEnv;
	}
}

export async function getAuth(): Promise<AppAuth> {
	if (cachedAuth) return cachedAuth;
	const env = await getAuthBindings();
	cachedAuth = createAuth(env);
	return cachedAuth;
}

export function createAuthFromBindings(env: AuthBindings): AppAuth {
	return createAuth(env);
}

export async function getAllowedSignupEmailDomains(): Promise<string> {
	const bindings = await getAuthBindings();
	return bindings.ALLOWED_SIGNUP_EMAIL_DOMAINS ?? appEnv.ALLOWED_SIGNUP_EMAIL_DOMAINS;
}
