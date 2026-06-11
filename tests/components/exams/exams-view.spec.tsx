import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExamsView } from "@/features/exams/components/list/exams-view";

const mockUseSuspenseQuery = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({
		invalidateQueries: mockInvalidateQueries,
	}),
	useSuspenseQuery: (options: unknown) => mockUseSuspenseQuery(options),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		...props
	}: {
		children: ReactNode;
		[key: string]: unknown;
	}) => <a {...props}>{children}</a>,
}));

vi.mock("@/server-functions/exams", () => ({
	deleteExam: vi.fn(),
	getExamsDetailed: vi.fn(),
}));

describe("ExamsView", () => {
	beforeEach(() => {
		mockUseSuspenseQuery.mockReset();
		mockInvalidateQueries.mockReset();
	});

	it("renders a wider two-column card grid with compact exam summaries", () => {
		mockUseSuspenseQuery.mockReturnValue({
			data: [
				{
					id: 1,
					name: "USP 2025",
					created_at: "2026-06-03T10:00:00.000Z",
					questionCount: 12,
					source: "Fuvest",
					topics: ["Cardiologia", "Pediatria", "Clínica"],
					files: [
						{ id: 1, name: "usp-2025.pdf", size: 512000 },
						{ id: 2, name: "gabarito.pdf", size: 24576 },
					],
				},
				{
					id: 2,
					name: "UNICAMP 2024",
					created_at: "2026-06-02T10:00:00.000Z",
					questionCount: 8,
					source: null,
					topics: ["Cirurgia"],
					files: [{ id: 3, name: "unicamp-2024.pdf", size: 1024 }],
				},
			],
		});

		render(<ExamsView />);

		expect(screen.getByTestId("exams-view").getAttribute("data-fullwidth")).toBe(
			"true",
		);
		expect(screen.getByTestId("exams-grid").className).toContain("md:grid-cols-2");
		expect(screen.getByTestId("exams-grid").className).toContain("xl:grid-cols-3");
		expect(screen.getByText("500.0 KB")).toBeTruthy();
		expect(screen.getByText("12 questions")).toBeTruthy();
		expect(screen.queryByText("usp-2025.pdf")).toBeNull();
		expect(screen.getByTestId("exam-title-1").textContent).toBe("USP 2025");
		expect(screen.getByTestId("exam-meta-1").textContent).toContain("03/06/2026");
		expect(screen.getByTestId("exam-topics-1").className).toContain("flex-nowrap");
		expect(screen.getByText("+2 more")).toBeTruthy();
		expect(screen.queryByText("Quiz")).toBeNull();
		expect(screen.queryByText("Details")).toBeNull();
		expect(screen.queryByText("Ready to quiz")).toBeNull();
		expect(screen.getByLabelText("Open exam USP 2025")).toBeTruthy();
	});
});
