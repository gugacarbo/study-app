import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const navigate = vi.fn();

vi.mock("@/components/theme-provider", () => ({
	useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
		useRouterState: () => "/",
	};
});

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signOut: vi.fn(),
	},
}));

function renderShell(ui: React.ReactNode) {
	return render(ui);
}

describe("AppShell", () => {
	afterEach(() => {
		cleanup();
		navigate.mockClear();
	});

	it("renders bottom navigation and page content", () => {
		renderShell(
			<AppShell
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			>
				<p>Conteúdo da página</p>
			</AppShell>,
		);

		expect(screen.getByText("Conteúdo da página")).toBeInTheDocument();
		expect(screen.getByRole("navigation", { name: /navegação principal/i })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /provas/i }));
		expect(navigate).toHaveBeenCalledWith({ to: "/exams" });
	});

	it("shows user initials in the account button", () => {
		renderShell(
			<AppShell
				user={{ name: "Gustavo Silva", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			>
				<p>Conteúdo</p>
			</AppShell>,
		);

		expect(screen.getByRole("button", { name: /conta/i })).toHaveTextContent("GS");
	});
});
