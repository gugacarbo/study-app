import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPageContent } from "@/routes/login/index";

vi.mock("@/functions/auth/require-session", () => ({
	getSession: vi.fn(async () => null),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: { magicLink: vi.fn() },
		signOut: vi.fn(),
	},
}));

describe("login page", () => {
	afterEach(() => {
		cleanup();
	});

	it("shows configured domain hint", () => {
		render(<LoginPageContent allowedSignupEmailDomains="ifsc.edu.br" />);
		expect(screen.getByText(/@ifsc\.edu\.br/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /enviar link/i })).toBeInTheDocument();
	});

	it("shows multiple domains when configured", () => {
		render(
			<LoginPageContent allowedSignupEmailDomains="ifsc.edu.br,example.com" />,
		);
		expect(
			screen.getByText(/@ifsc\.edu\.br, @example\.com/i),
		).toBeInTheDocument();
	});
});
