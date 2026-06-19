import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminSidebarNav } from "@/features/admin/components/admin-sidebar-nav";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
}));

function renderNav(pathname: string, options?: { onNavigate?: () => void }) {
	return render(
		<TooltipProvider>
			<SidebarProvider>
				<AdminSidebarNav pathname={pathname} onNavigate={options?.onNavigate} />
			</SidebarProvider>
		</TooltipProvider>,
	);
}

describe("AdminSidebarNav", () => {
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
	});

	it("renders all admin nav items with icon labels", () => {
		renderNav("/admin/config");

		expect(
			screen.getByRole("navigation", { name: /administração/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /config/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /usuários/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /jobs/i })).toBeInTheDocument();
	});

	it("marks the matching route as active by pathname prefix", () => {
		renderNav("/admin/users/settings");

		expect(screen.getByRole("button", { name: /config/i })).toHaveAttribute(
			"data-active",
			"false",
		);
		expect(screen.getByRole("button", { name: /usuários/i })).toHaveAttribute(
			"data-active",
			"true",
		);
		expect(screen.getByRole("button", { name: /jobs/i })).toHaveAttribute(
			"data-active",
			"false",
		);
	});

	it("navigates via SPA and calls onNavigate on click", () => {
		const onNavigate = vi.fn();
		renderNav("/admin/config", { onNavigate });

		fireEvent.click(screen.getByRole("button", { name: /jobs/i }));

		expect(navigate).toHaveBeenCalledWith({ to: "/admin/jobs" });
		expect(onNavigate).toHaveBeenCalledOnce();
	});
});
