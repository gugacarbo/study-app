import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { loadEnv } from "vite";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { formatAllowedDomainsHint, serverEnvFrom } from "@/env";
import { LoginPageContent } from "@/routes/login/index";

const assign = vi.fn();

const { ALLOWED_SIGNUP_EMAIL_DOMAINS: allowedSignupEmailDomains } =
	serverEnvFrom({
		ALLOWED_SIGNUP_EMAIL_DOMAINS: "aluno.ifsc.edu.br",
		...loadEnv("test", process.cwd(), ""),
	});

vi.mock("@/functions/auth/require-session", () => ({
	getSession: vi.fn(async () => null),
}));

vi.mock("@/functions/auth/dev-login-with-token", () => ({
	devLoginWithToken: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: { magicLink: vi.fn() },
		signOut: vi.fn(),
	},
}));

describe("login page", () => {
	const originalLocation = window.location;

	beforeAll(() => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...originalLocation, assign },
		});
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	afterAll(() => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
	});

	it("shows configured domain hint", () => {
		render(
			<LoginPageContent
				allowedSignupEmailDomains={allowedSignupEmailDomains}
			/>,
		);
		expect(
			screen.getByText(formatAllowedDomainsHint(allowedSignupEmailDomains)),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /enviar link/i }),
		).toBeInTheDocument();
	});

	it("shows multiple domains when configured", () => {
		render(
			<LoginPageContent allowedSignupEmailDomains="ifsc.edu.br,example.com" />,
		);
		expect(
			screen.getByText(/@ifsc\.edu\.br, @example\.com/i),
		).toBeInTheDocument();
	});

	it("shows a single dev auto-login action instead of the token field", async () => {
		const { devLoginWithToken } = await import(
			"@/functions/auth/dev-login-with-token"
		);
		vi.mocked(devLoginWithToken).mockResolvedValue({
			ok: true,
			email: "aluno@aluno.ifsc.edu.br",
			userId: "user-1",
		});

		render(
			<LoginPageContent
				allowedSignupEmailDomains={allowedSignupEmailDomains}
			/>,
		);

		fireEvent.change(screen.getByLabelText(/email/i), {
			target: { value: "aluno@aluno.ifsc.edu.br" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: /entrar automaticamente/i }),
		);

		expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument();
		await waitFor(() => {
			expect(devLoginWithToken).toHaveBeenCalledWith({
				data: { email: "aluno@aluno.ifsc.edu.br" },
			});
			expect(assign).toHaveBeenCalledWith("/");
		});
	});

	it("uses the current email input value for dev login even without a change event", async () => {
		const { devLoginWithToken } = await import(
			"@/functions/auth/dev-login-with-token"
		);
		vi.mocked(devLoginWithToken).mockResolvedValue({
			ok: true,
			email: "dev@hotmail.com",
			userId: "user-2",
		});

		render(<LoginPageContent allowedSignupEmailDomains="hotmail.com" />);

		const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
		emailInput.value = "dev@hotmail.com";

		fireEvent.click(
			screen.getByRole("button", { name: /entrar automaticamente/i }),
		);

		await waitFor(() => {
			expect(devLoginWithToken).toHaveBeenCalledWith({
				data: { email: "dev@hotmail.com" },
			});
		});
	});
});
