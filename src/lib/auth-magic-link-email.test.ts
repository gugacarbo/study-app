import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMagicLinkEmail } from "@/lib/auth-magic-link-email";

const baseEnv = {
	EMAIL_FROM_ADDRESS: "noreply@gugacarbo.space",
	EMAIL_FROM_NAME: "Study App",
	RESEND_API_KEY: "re_test_key",
	DEV_LOG_EMAILS: false,
	NODE_ENV: "development" as const,
};

describe("sendMagicLinkEmail", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("logs email content without calling Resend when DEV_LOG_EMAILS is enabled in development", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		await sendMagicLinkEmail(
			{ ...baseEnv, DEV_LOG_EMAILS: true },
			"aluno@ifsc.edu.br",
			"http://localhost:3000/auth/magic-link?token=abc123",
		);

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalledWith(
			"[auth] magic link (DEV_LOG_EMAILS — console only)",
			expect.objectContaining({
				from: "Study App <noreply@gugacarbo.space>",
				to: "aluno@ifsc.edu.br",
				subject: "Seu link de acesso — Study App",
				text: "Acesse: http://localhost:3000/auth/magic-link?token=abc123",
				html: expect.stringContaining("abc123"),
			}),
		);
	});

	it("sends via Resend when DEV_LOG_EMAILS is enabled but NODE_ENV is production", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
		);

		await sendMagicLinkEmail(
			{ ...baseEnv, DEV_LOG_EMAILS: true, NODE_ENV: "production" },
			"aluno@ifsc.edu.br",
			"http://localhost:3000/auth/magic-link?token=abc123",
		);

		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.resend.com/emails",
			expect.objectContaining({ method: "POST" }),
		);
	});
});
