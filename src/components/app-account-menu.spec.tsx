import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppAccountMenu } from "@/components/app-account-menu";

const navigate = vi.fn();
const setTheme = vi.fn();

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

async function openAccountMenu() {
	const trigger = screen.getByRole("button", { name: /conta/i });
	fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
	fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
	fireEvent.click(trigger);

	await waitFor(() => {
		expect(screen.getByRole("menu")).toBeInTheDocument();
	});
}

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

describe("AppAccountMenu", () => {
	afterEach(() => {
		cleanup();
		navigate.mockClear();
		setTheme.mockClear();
	});

	it("shows initials GS for Gustavo Silva", () => {
		render(
			<AppAccountMenu
				user={{ name: "Gustavo Silva", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			/>,
		);

		expect(screen.getByRole("button", { name: /conta/i })).toHaveTextContent(
			"GS",
		);
	});

	it("shows Administração when isAdmin", async () => {
		render(
			<AppAccountMenu
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={true}
			/>,
		);

		await openAccountMenu();
		expect(screen.getByText("Administração")).toBeInTheDocument();
	});

	it("hides Administração when not admin", async () => {
		render(
			<AppAccountMenu
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			/>,
		);

		await openAccountMenu();
		expect(screen.queryByText("Administração")).not.toBeInTheDocument();
	});

	it("navigates to profile when clicking Perfil", async () => {
		render(
			<AppAccountMenu
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			/>,
		);

		await openAccountMenu();
		fireEvent.click(screen.getByText("Perfil"));

		expect(navigate).toHaveBeenCalledWith({ to: "/profile" });
	});

	it("navigates to user jobs when clicking Meus jobs", async () => {
		render(
			<AppAccountMenu
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			/>,
		);

		await openAccountMenu();
		fireEvent.click(screen.getByText("Meus jobs"));

		expect(navigate).toHaveBeenCalledWith({
			to: "/jobs",
			search: { page: 1 },
		});
	});

	it("calls signOut on Sair", async () => {
		const { authClient } = await import("@/lib/auth-client");

		render(
			<AppAccountMenu
				user={{ name: "Gustavo", email: "aluno@ifsc.edu.br" }}
				isAdmin={false}
			/>,
		);

		await openAccountMenu();
		fireEvent.click(screen.getByText("Sair"));

		await waitFor(() => {
			expect(authClient.signOut).toHaveBeenCalled();
			expect(navigate).toHaveBeenCalledWith({ to: "/login" });
		});
	});
});
