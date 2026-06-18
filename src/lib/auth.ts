import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { createDb } from "@/db/client";
import { authSchema } from "@/db/schema";
import { bootstrapUserRoles } from "@/lib/rbac-bootstrap";
import { isAllowedSignupEmail } from "@/lib/auth-allowed-email-domain";

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

async function sendMagicLinkEmail(
	env: AuthBindings,
	email: string,
	url: string,
) {
	if (env.RESEND_API_KEY) {
		const fromName = env.EMAIL_FROM_NAME ?? "Study App";
		const fromAddress = env.EMAIL_FROM_ADDRESS ?? "noreply@gugacarbo.space";
		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: `${fromName} <${fromAddress}>`,
				to: [email],
				subject: "Seu link de acesso — Study App",
				text: `Acesse: ${url}`,
				html: `<p>Acesse: <a href="${url}">${url}</a></p>`,
			}),
		});
		if (!response.ok) {
			throw new Error(`Resend failed: ${response.status}`);
		}
		return;
	}

	console.log("[auth] magic link", email, url);
}

export function createAuth(env: AuthBindings) {
	const db = drizzle(env.DB, { schema: authSchema });
	const appDb = createDb(env.DB);
	const allowedDomains = env.ALLOWED_SIGNUP_EMAIL_DOMAINS ?? "ifsc.edu.br";

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
						throw new APIError("BAD_REQUEST", {
							message: "Este email não está autorizado",
						});
					}
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

export async function getAuthBindings(): Promise<AuthBindings> {
	if (cachedAuthEnv) return cachedAuthEnv;

	try {
		const mod = (await import(
			/* @vite-ignore */ "cloudflare:workers"
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
			ALLOWED_SIGNUP_EMAIL_DOMAINS:
				process.env.ALLOWED_SIGNUP_EMAIL_DOMAINS ?? "ifsc.edu.br",
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
