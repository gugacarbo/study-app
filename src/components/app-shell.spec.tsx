import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const navigate = vi.fn();
let mockPathname = "/";

vi.mock("@/components/theme-provider", () => ({
	useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
		useRouterState: (options?: {
			select?: (state: { location: { pathname: string } }) => string;
		}) => {
			return options?.select?.({ location: { pathname: mockPathname } }) ?? mockPathname;
		},
		Link: ({
			to,
			children,
			...props
		}: {
			to: string;
			children: React.ReactNode;
			"aria-current"?: "page" | undefined;
			className?: string;
		}) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
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
	beforeEach(() => {
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: query.includes("min-width: 768px"),
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	afterEach(() => {
		cleanup();
		navigate.mockClear();
		mockPathname = "/";
	});

	it("renders desktop nav links and no bottom bar", () => {
		renderShell(
			<AppShell
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			>
				<p>Conteúdo da página</p>
			</AppShell>,
		);

		expect(screen.getByText("Conteúdo da página")).toBeInTheDocument();
		expect(
			screen.getByRole("navigation", { name: /navegação principal/i }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^provas$/i }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: /provas/i })).toBeInTheDocument();
	});

	it("does not render Study App subtitle", () => {
		renderShell(
			<AppShell
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			>
				<p>Conteúdo</p>
			</AppShell>,
		);

		expect(screen.queryByText("Study App")).not.toBeInTheDocument();
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

		expect(screen.getByRole("button", { name: /conta/i })).toHaveTextContent(
			"GS",
		);
	});

	it("shows Menu button for mobile navigation", () => {
		renderShell(
			<AppShell
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			>
				<p>Conteúdo</p>
			</AppShell>,
		);

		expect(screen.getByRole("button", { name: /menu/i })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /menu/i }));
		expect(screen.getAllByRole("button", { name: /provas/i }).length).toBeGreaterThan(
			0,
		);
	});

	it("uses wide layout on job monitor routes", () => {
		mockPathname = "/jobs/job-1";

		const { container } = renderShell(
			<AppShell
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			>
				<p>Job</p>
			</AppShell>,
		);

		expect(container.firstChild).toHaveClass("max-w-screen-xl");
	});
});
