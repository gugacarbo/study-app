import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminMainHeader } from "@/features/admin/components/admin-main-header";

let mockPathname = "/admin/config";

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useRouterState: (options?: {
			select?: (state: { location: { pathname: string } }) => string;
		}) => {
			return (
				options?.select?.({ location: { pathname: mockPathname } }) ??
				mockPathname
			);
		},
	};
});

function renderHeader() {
	return render(
		<SidebarProvider>
			<AdminMainHeader />
		</SidebarProvider>,
	);
}

describe("AdminMainHeader", () => {
	beforeEach(() => {
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: query.includes("min-width: 1024px"),
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
		mockPathname = "/admin/config";
	});

	it("renders sidebar trigger and page title", () => {
		renderHeader();

		expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Config");
	});

	it.each([
		{ pathname: "/admin/config", title: "Config" },
		{ pathname: "/admin/users", title: "Usuários" },
		{ pathname: "/admin/jobs", title: "Jobs" },
	])("shows title $title for $pathname", ({ pathname, title }) => {
		mockPathname = pathname;
		renderHeader();

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
	});
});
