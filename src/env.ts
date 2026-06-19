import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const server = {
	BETTER_AUTH_SECRET: z.string().min(32).optional(),
	BETTER_AUTH_URL: z.string().url().optional(),
	RESEND_API_KEY: z.string().min(1).optional(),
	CONFIG_ENCRYPTION_KEY: z.string().min(1).optional(),
	TAVILY_API_KEY: z.string().min(1).optional(),
	ALLOWED_SIGNUP_EMAIL_DOMAINS: z.string().default("aluno.ifsc.edu.br"),
	EMAIL_FROM_ADDRESS: z.string().email().default("noreply@gugacarbo.space"),
	EMAIL_FROM_NAME: z.string().default("Study App"),
	ADMIN_EMAILS: z.string().default(""),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
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
	"RESEND_API_KEY" | "EMAIL_FROM_ADDRESS" | "EMAIL_FROM_NAME"
>;

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
