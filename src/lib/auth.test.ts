import type { D1Database } from "@cloudflare/workers-types";
import { describe, expect, it } from "vitest";
import { createAuth } from "@/lib/auth";

describe("auth", () => {
	it("creates better-auth instance with magic link plugin", () => {
		const auth = createAuth({
			DB: {} as D1Database,
			BETTER_AUTH_SECRET: "x".repeat(32),
			BETTER_AUTH_URL: "http://localhost:3000",
			ALLOWED_SIGNUP_EMAIL_DOMAINS: "aluno.ifsc.edu.br",
			EMAIL_FROM_ADDRESS: "noreply@gugacarbo.space",
			EMAIL_FROM_NAME: "Study App",
			ADMIN_EMAILS: "",
			DEV_LOG_EMAILS: false,
			NODE_ENV: "development",
		});

		expect(auth).toBeDefined();
		expect(auth.api.getSession).toBeTypeOf("function");
	});
});
