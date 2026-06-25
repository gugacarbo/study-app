import { beforeEach, describe, expect, it, vi } from "vitest";

const setCookieMock = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	setCookie: setCookieMock,
}));

describe("dev-login-helpers", () => {
	beforeEach(() => {
		setCookieMock.mockReset();
	});

	it("sets the Better Auth session cookie without pre-encoding the signed value", async () => {
		const { setSessionCookie } = await import(
			"./dev-login-helpers.server"
		);

		await setSessionCookie(
			{
				DB: {} as never,
				BETTER_AUTH_SECRET: "x".repeat(32),
				BETTER_AUTH_URL: "http://localhost:8787",
				ALLOWED_SIGNUP_EMAIL_DOMAINS: "hotmail.com",
				EMAIL_FROM_ADDRESS: "noreply@gugacarbo.space",
				EMAIL_FROM_NAME: "Study App",
				ADMIN_EMAIL: "admin@aluno.ifsc.edu.br",
				DEV_LOG_EMAILS: true,
				NODE_ENV: "development",
			},
			"session-token-123",
		);

		expect(setCookieMock).toHaveBeenCalledOnce();
		expect(setCookieMock).toHaveBeenCalledWith(
			"better-auth.session_token",
			expect.stringMatching(/^session-token-123\.[A-Za-z0-9+/=]+$/),
			expect.objectContaining({
				httpOnly: true,
				path: "/",
				sameSite: "lax",
				secure: false,
			}),
		);
	});
});
