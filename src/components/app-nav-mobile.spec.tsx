import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNavMobile } from "@/components/app-nav-mobile";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
}));

describe("AppNavMobile", () => {
	afterEach(() => {
		cleanup();
		navigate.mockClear();
	});

	it("hides inline links and shows Menu button on mobile", () => {
		render(<AppNavMobile pathname="/" />);

		expect(screen.getByRole("button", { name: /menu/i })).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /provas/i }),
		).not.toBeInTheDocument();
	});

	it("opens sheet on Menu click", async () => {
		render(<AppNavMobile pathname="/" />);

		fireEvent.click(screen.getByRole("button", { name: /menu/i }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /provas/i }),
			).toBeInTheDocument();
		});
	});

	it("navigates and closes sheet on item click", async () => {
		render(<AppNavMobile pathname="/" />);

		fireEvent.click(screen.getByRole("button", { name: /menu/i }));

		const provasButton = await screen.findByRole("button", { name: /provas/i });
		fireEvent.click(provasButton);

		expect(navigate).toHaveBeenCalledWith({ to: "/exams" });

		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: /provas/i }),
			).not.toBeInTheDocument();
		});
	});

	it("closes sheet when selecting current route", async () => {
		render(<AppNavMobile pathname="/" />);

		fireEvent.click(screen.getByRole("button", { name: /menu/i }));

		const inicioButton = await screen.findByRole("button", { name: /início/i });
		fireEvent.click(inicioButton);

		expect(navigate).toHaveBeenCalledWith({ to: "/" });

		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: /início/i }),
			).not.toBeInTheDocument();
		});
	});
});
