import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/routes/login/index";

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
	it("shows ifsc domain hint", () => {
		render(<LoginPage />);
		expect(screen.getByText(/@ifsc.edu.br/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /enviar link/i })).toBeInTheDocument();
	});
});
