import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		BETTER_AUTH_SECRET: z.string().min(32).optional(),
		BETTER_AUTH_URL: z.string().url().optional(),
		RESEND_API_KEY: z.string().min(1).optional(),
		CONFIG_ENCRYPTION_KEY: z.string().min(1).optional(),
		ALLOWED_SIGNUP_EMAIL_DOMAINS: z.string().default("aluno.ifsc.edu.br"),
		EMAIL_FROM_ADDRESS: z.string().email().default("noreply@gugacarbo.space"),
		EMAIL_FROM_NAME: z.string().default("Study App"),
		ADMIN_EMAILS: z.string().default(""),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	clientPrefix: "VITE_",
	client: {},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
	skipValidation: process.env.NODE_ENV === "test",
});

export type AppEnv = {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	RESEND_API_KEY?: string;
	CONFIG_ENCRYPTION_KEY?: string;
	ALLOWED_SIGNUP_EMAIL_DOMAINS: string;
	EMAIL_FROM_ADDRESS: string;
	EMAIL_FROM_NAME: string;
	ADMIN_EMAILS: string;
};

export function parseAdminEmails(raw: string): Set<string> {
	return new Set(
		raw
			.split(",")
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean),
	);
}

export function getAllowedSignupDomains(raw: string): string[] {
	return raw
		.split(",")
		.map((domain) => domain.trim().toLowerCase())
		.filter(Boolean);
}

export function formatAllowedDomainsHint(raw: string): string {
	return getAllowedSignupDomains(raw)
		.map((domain) => `@${domain}`)
		.join(", ");
}

export function getPlaceholderEmail(raw: string): string {
	const [firstDomain] = getAllowedSignupDomains(raw);
	return firstDomain ? `voce@${firstDomain}` : "voce@exemplo.com";
}

export function formatUnauthorizedEmailMessage(raw: string): string {
	const hint = formatAllowedDomainsHint(raw);
	return hint
		? `Este email não está autorizado. Use ${hint}.`
		: "Este email não está autorizado.";
}
