import type { D1Database } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import { createDb } from "@/db/client";
import { authSchema } from "@/db/schema";
import { env, hasGoogleAuthConfig, serverEnvFrom } from "@/env";
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
	ADMIN_EMAIL: string;
	RESEND_API_KEY?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	DEV_LOG_EMAILS: boolean;
	NODE_ENV: "development" | "production" | "test";
};

type AuthEnvSource = Partial<
	Omit<AuthBindings, "DB" | "DEV_LOG_EMAILS" | "NODE_ENV">
> & {
	DB?: D1Database;
	DEV_LOG_EMAILS?: boolean | string;
	NODE_ENV?: AuthBindings["NODE_ENV"] | string;
};

/** Loopback origins used by Vite (:3000) and Localflare (:8787). */
const LOCAL_DEV_TRUSTED_ORIGINS = [
	"http://localhost:3000",
	"http://localhost:8787",
	"http://127.0.0.1:3000",
	"http://127.0.0.1:8787",
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
		ADMIN_EMAIL: validated.ADMIN_EMAIL,
		RESEND_API_KEY: validated.RESEND_API_KEY,
		GOOGLE_CLIENT_ID: validated.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: validated.GOOGLE_CLIENT_SECRET,
		DEV_LOG_EMAILS: validated.DEV_LOG_EMAILS,
		NODE_ENV: validated.NODE_ENV,
	};
}

function throwUnauthorizedEmail(email: string, allowedDomains: string): never {
	authLog("auth rejected (email not allowed)", {
		email,
		allowedDomains,
	});
	throw new APIError("BAD_REQUEST", {
		message: "Este email não está autorizado",
	});
}

function assertAllowedAuthEmail(email: string, allowedDomains: string): string {
	if (!isAllowedSignupEmail(email, allowedDomains)) {
		throwUnauthorizedEmail(email, allowedDomains);
	}
	return email;
}

export function createAuth(authBindings: AuthBindings) {
	const db = drizzle(authBindings.DB, { schema: authSchema });
	const appDb = createDb(authBindings.DB);
	const allowedDomains = authBindings.ALLOWED_SIGNUP_EMAIL_DOMAINS;
	const googleSocialProvider = hasGoogleAuthConfig(authBindings)
		? {
				google: {
					clientId: authBindings.GOOGLE_CLIENT_ID as string,
					clientSecret: authBindings.GOOGLE_CLIENT_SECRET as string,
					scope: ["email", "profile"],
					mapProfileToUser: (profile: {
						email?: string;
						name?: string;
						picture?: string;
						verified_email?: boolean;
					}) => {
						const email = assertAllowedAuthEmail(
							profile.email ?? "",
							allowedDomains,
						);

						return {
							email,
							name: profile.name?.trim() || email,
							image: profile.picture,
							emailVerified: profile.verified_email === true,
						};
					},
				},
			}
		: undefined;

	const trustedOrigins = getLocalDevTrustedOrigins(
		authBindings.BETTER_AUTH_URL,
	);

		return betterAuth({
		secret: authBindings.BETTER_AUTH_SECRET,
		baseURL: authBindings.BETTER_AUTH_URL,
		onAPIError: {
			errorURL: "/auth-error",
		},
		...(trustedOrigins ? { trustedOrigins } : {}),
		...(googleSocialProvider
			? {
					socialProviders: googleSocialProvider,
				}
			: {}),
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
							authBindings.ADMIN_EMAIL,
						);
					},
				},
			},
		},
		plugins: [
			magicLink({
				expiresIn: 600,
				sendMagicLink: async ({ email, url }) => {
					assertAllowedAuthEmail(email, allowedDomains);
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
let cachedWorkersEnv: AuthEnvSource | null | undefined;
const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

async function getAuthEnvFromCloudflareWorkersModule(): Promise<
	AuthEnvSource | undefined
> {
	if (cachedWorkersEnv === undefined) {
		try {
			const mod = (await import(
				/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE
			)) as { env?: AuthEnvSource };
			cachedWorkersEnv = mod.env ?? null;
		} catch {
			cachedWorkersEnv = null;
		}
	}

	return cachedWorkersEnv ?? undefined;
}

function getAuthEnvFromGlobalCloudflare(): AuthEnvSource | undefined {
	const cf = globalThis as {
		cloudflare?: {
			env?: AuthEnvSource;
		};
	};

	return cf.cloudflare?.env;
}

export async function getAuthBindings(): Promise<AuthBindings> {
	if (cachedAuthEnv) return cachedAuthEnv;

	const globalEnv = getAuthEnvFromGlobalCloudflare();
	const workersEnv = await getAuthEnvFromCloudflareWorkersModule();
	const mergedEnv = {
		...(env as unknown as Record<string, unknown>),
		...(globalEnv ?? {}),
		...(workersEnv ?? {}),
	};

	cachedAuthEnv = toAuthBindings(
		(workersEnv?.DB ?? globalEnv?.DB) as D1Database,
		mergedEnv,
	);
	return cachedAuthEnv;
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

export async function isGoogleAuthEnabled(): Promise<boolean> {
	const bindings = await getAuthBindings();
	return hasGoogleAuthConfig(bindings);
}
