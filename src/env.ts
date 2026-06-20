import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const server = {
	// | Secrets
	// | Better Auth
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url(),
	// | Resend
	RESEND_API_KEY: z.string().min(1),
	// | Config Encryption
	CONFIG_ENCRYPTION_KEY: z.string().min(1),
	// | Tavily
	TAVILY_API_KEY: z.string().min(1).optional(),
	// ? Vars
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	ALLOWED_SIGNUP_EMAIL_DOMAINS: z.string().default("aluno.ifsc.edu.br"),
	ADMIN_EMAILS: z.string().default(""),
	// ? Email
	EMAIL_FROM_ADDRESS: z.email().default("noreply@gugacarbo.space"),
	EMAIL_FROM_NAME: z.string().default("Study App"),
	DEV_LOG_EMAILS: z
		.string()
		.default("true")
		.transform((value) => value === "true"),
} as const;

const serverEnvKeys = Object.keys(server) as (keyof typeof server)[];

const envConfig = {
	server,
	clientPrefix: "VITE_" as const,
	client: {},
	emptyStringAsUndefined: true,
	skipValidation: process.env.NODE_ENV === "test",
};

function pickRuntimeEnv(
	source: Record<string, unknown>,
): Record<string, string | undefined> {
	const runtime: Record<string, string | undefined> = {};

	for (const key of serverEnvKeys) {
		const value = source[key];
		runtime[key] =
			typeof value === "string"
				? value
				: value === undefined
					? undefined
					: String(value);
	}

	if (!runtime.NODE_ENV && typeof process !== "undefined") {
		runtime.NODE_ENV = process.env.NODE_ENV;
	}

	return runtime;
}

export const env = createEnv({
	...envConfig,
	runtimeEnv: pickRuntimeEnv(process.env),
});

export function serverEnvFrom(source: Record<string, unknown>) {
	return createEnv({
		...envConfig,
		runtimeEnv: pickRuntimeEnv(source),
	});
}

export type ServerEnv = typeof env;

export type MagicLinkEmailEnv = Pick<
	ServerEnv,
	"EMAIL_FROM_ADDRESS" | "EMAIL_FROM_NAME" | "DEV_LOG_EMAILS" | "NODE_ENV"
> & {
	RESEND_API_KEY?: string;
};

export function shouldLogEmailsToConsole(
	devLogEmails: boolean,
	nodeEnv: ServerEnv["NODE_ENV"],
): boolean {
	return nodeEnv === "development" && devLogEmails;
}

export function parseAdminEmails(raw: string): Set<string> {
	return new Set(
		raw
			.split(",")
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean),
	);
}

export function getAllowedSignupDomains(raw: string | undefined): string[] {
	return (raw ?? "aluno.ifsc.edu.br")
		.split(",")
		.map((domain) => domain.trim().toLowerCase())
		.filter(Boolean);
}

export function formatAllowedDomainsHint(raw: string | undefined): string {
	return getAllowedSignupDomains(raw)
		.map((domain) => `@${domain}`)
		.join(", ");
}

export function getPlaceholderEmail(raw: string | undefined): string {
	const [firstDomain] = getAllowedSignupDomains(raw);
	return firstDomain ? `voce@${firstDomain}` : "voce@exemplo.com";
}

export function formatUnauthorizedEmailMessage(raw: string | undefined): string {
	const hint = formatAllowedDomainsHint(raw);
	return hint
		? `Este email não está autorizado. Use ${hint}.`
		: "Este email não está autorizado.";
}
