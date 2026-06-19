import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNavDesktop } from "@/components/app-nav-desktop";

vi.mock("@tanstack/react-router", () => ({
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
}));

describe("AppNavDesktop", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders Início, Provas, Importar at md viewport", () => {
		render(<AppNavDesktop pathname="/" />);

		expect(screen.getByRole("link", { name: /início/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /provas/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /importar/i })).toBeInTheDocument();
	});

	it("marks active route with aria-current=page", () => {
		render(<AppNavDesktop pathname="/exams" />);

		expect(screen.getByRole("link", { name: /provas/i })).toHaveAttribute(
			"aria-current",
			"page",
		);
	});
});
