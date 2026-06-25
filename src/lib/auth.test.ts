import type { D1Database } from "@cloudflare/workers-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/lib/auth";

describe("auth", () => {
	afterEach(() => {
		vi.resetModules();
		delete (
			globalThis as {
				cloudflare?: { env?: Record<string, unknown> };
			}
		).cloudflare;
	});

	it("creates better-auth instance with magic link plugin", () => {
		const auth = createAuth({
			DB: {} as D1Database,
			BETTER_AUTH_SECRET: "x".repeat(32),
			BETTER_AUTH_URL: "http://localhost:3000",
			ALLOWED_SIGNUP_EMAIL_DOMAINS: "aluno.ifsc.edu.br",
			EMAIL_FROM_ADDRESS: "noreply@gugacarbo.space",
			EMAIL_FROM_NAME: "Study App",
			ADMIN_EMAIL: "admin@aluno.ifsc.edu.br",
			DEV_LOG_EMAILS: false,
			NODE_ENV: "development",
		});

		expect(auth).toBeDefined();
		expect(auth.api.getSession).toBeTypeOf("function");
	});

	it("configures google social sign-in when credentials are available", () => {
		const auth = createAuth({
			DB: {} as D1Database,
			BETTER_AUTH_SECRET: "x".repeat(32),
			BETTER_AUTH_URL: "http://localhost:3000",
			ALLOWED_SIGNUP_EMAIL_DOMAINS: "aluno.ifsc.edu.br",
			EMAIL_FROM_ADDRESS: "noreply@gugacarbo.space",
			EMAIL_FROM_NAME: "Study App",
			ADMIN_EMAIL: "admin@aluno.ifsc.edu.br",
			GOOGLE_CLIENT_ID: "google-client-id",
			GOOGLE_CLIENT_SECRET: "google-client-secret",
			DEV_LOG_EMAILS: false,
			NODE_ENV: "development",
		} as Parameters<typeof createAuth>[0]);

		expect((auth as { options?: { socialProviders?: { google?: unknown } } }).options
			?.socialProviders?.google).toBeDefined();
	});

	it("enables google auth when secrets are available on global cloudflare env", async () => {
		(
			globalThis as {
				cloudflare?: { env?: Record<string, unknown> };
			}
		).cloudflare = {
			env: {
				GOOGLE_CLIENT_ID: "google-client-id",
				GOOGLE_CLIENT_SECRET: "google-client-secret",
			},
		};

		const { isGoogleAuthEnabled } = await import("@/lib/auth");

		await expect(isGoogleAuthEnabled()).resolves.toBe(true);
	});
});
