import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminSidebarFooter } from "@/features/admin/components/admin-sidebar-footer";

const navigate = vi.fn();
const setTheme = vi.fn();

const testUser = {
	name: "Gustavo Silva",
	email: "aluno@ifsc.edu.br",
};

beforeAll(() => {
	Object.defineProperty(Element.prototype, "hasPointerCapture", {
		value: vi.fn(),
		writable: true,
	});
	Object.defineProperty(Element.prototype, "setPointerCapture", {
		value: vi.fn(),
		writable: true,
	});
	Object.defineProperty(Element.prototype, "releasePointerCapture", {
		value: vi.fn(),
		writable: true,
	});
});

vi.mock("@/components/theme-provider", () => ({
	useTheme: () => ({ theme: "light", setTheme }),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signOut: vi.fn().mockResolvedValue(undefined),
	},
}));

function renderFooter() {
	return render(
		<TooltipProvider>
			<SidebarProvider>
				<AdminSidebarFooter user={testUser} />
			</SidebarProvider>
		</TooltipProvider>,
	);
}

async function openAccountMenu() {
	const trigger = screen.getByRole("button", { name: /conta/i });
	fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
	fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
	fireEvent.click(trigger);

	await waitFor(() => {
		expect(screen.getByRole("menu")).toBeInTheDocument();
	});
}

describe("AdminSidebarFooter", () => {
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
		setTheme.mockClear();
	});

	it("navigates to home on Voltar ao app", () => {
		renderFooter();

		fireEvent.click(screen.getByRole("button", { name: /voltar ao app/i }));

		expect(navigate).toHaveBeenCalledWith({ to: "/" });
	});

	it("toggles theme on Alternar tema", () => {
		renderFooter();

		fireEvent.click(screen.getByRole("button", { name: /alternar tema/i }));

		expect(setTheme).toHaveBeenCalledWith("dark");
	});

	it("shows user name and email in account menu without Administração link", async () => {
		renderFooter();

		await openAccountMenu();

		expect(screen.getByText("Gustavo Silva")).toBeInTheDocument();
		expect(screen.getByText("aluno@ifsc.edu.br")).toBeInTheDocument();
		expect(screen.queryByText("Administração")).not.toBeInTheDocument();
	});

	it("calls signOut and navigates to login on Sair", async () => {
		const { authClient } = await import("@/lib/auth-client");

		renderFooter();

		await openAccountMenu();
		fireEvent.click(screen.getByText("Sair"));

		await waitFor(() => {
			expect(authClient.signOut).toHaveBeenCalled();
			expect(navigate).toHaveBeenCalledWith({ to: "/login" });
		});
	});
});
