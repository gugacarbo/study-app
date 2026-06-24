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
import { AdminDashboardShell } from "@/features/admin/components/admin-dashboard-shell";

const navigate = vi.fn();
let mockPathname = "/admin/models";
const user = { name: "Gustavo Silva", email: "aluno@ifsc.edu.br" };
const { readSidebarCookie, writeSidebarCookie } = vi.hoisted(() => ({
	readSidebarCookie: vi.fn((): "expanded" | "collapsed" => "expanded"),
	writeSidebarCookie: vi.fn(),
}));

vi.mock("@/components/theme-provider", () => ({
	useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({
	authClient: { signOut: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/lib/sidebar-cookie", () => ({
	readSidebarCookie,
	writeSidebarCookie,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
		useRouterState: (o?: {
			select?: (s: { location: { pathname: string } }) => string;
		}) => o?.select?.({ location: { pathname: mockPathname } }) ?? mockPathname,
	};
});

function mockViewport(desktop: boolean) {
	Object.defineProperty(window, "innerWidth", {
		writable: true,
		configurable: true,
		value: desktop ? 1280 : 375,
	});
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		configurable: true,
		value: vi.fn().mockImplementation((q: string) => ({
			matches: desktop
				? q.includes("min-width: 1024px") || q.includes("min-width: 768px")
				: q.includes("max-width: 767px"),
			media: q,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
}

const shell = (child = <p>Conteúdo</p>) =>
	render(<AdminDashboardShell user={user}>{child}</AdminDashboardShell>);

beforeAll(() => {
	for (const m of [
		"hasPointerCapture",
		"setPointerCapture",
		"releasePointerCapture",
	] as const) {
		Object.defineProperty(Element.prototype, m, {
			value: vi.fn(),
			writable: true,
		});
	}
});

describe("AdminDashboardShell", () => {
	beforeEach(() => {
		mockViewport(true);
		readSidebarCookie.mockReturnValue("expanded");
	});
	afterEach(() => {
		cleanup();
		navigate.mockClear();
		readSidebarCookie.mockClear();
		writeSidebarCookie.mockClear();
		mockPathname = "/admin/models";
	});

	it("renders admin nav items Modelos, Usuários and Jobs on desktop", () => {
		shell(<p>Conteúdo admin</p>);
		expect(screen.getByText("Conteúdo admin")).toBeInTheDocument();
		expect(
			screen.getByRole("navigation", { name: /administração/i }),
		).toBeInTheDocument();
		for (const n of [/modelos/i, /usuários/i, /jobs/i]) {
			expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
		}
	});

	it.each([
		["Modelos", "/admin/models"],
		["Usuários", "/admin/users"],
		["Jobs", "/admin/jobs"],
	] as const)("shows title %s for %s", (title, pathname) => {
		mockPathname = pathname;
		shell();
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
	});

	it("reads initial sidebar state from readSidebarCookie", () => {
		readSidebarCookie.mockReturnValue("collapsed");
		shell();
		expect(readSidebarCookie).toHaveBeenCalled();
		expect(document.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
			"data-state",
			"collapsed",
		);
	});

	it("persists sidebar collapse via writeSidebarCookie on toggle", () => {
		shell();
		fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
		expect(writeSidebarCookie).toHaveBeenCalledWith("collapsed");
	});

	it("opens and closes mobile sheet on nav selection", async () => {
		mockViewport(false);
		shell();
		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: /modelos/i }),
			).not.toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
		await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
		fireEvent.click(screen.getByRole("button", { name: /jobs/i }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		expect(navigate).toHaveBeenCalledWith({ to: "/admin/jobs" });
	});
});
