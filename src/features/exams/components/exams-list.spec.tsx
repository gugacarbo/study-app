import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamsList } from "@/features/exams/components/exams-list";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
	};
});

describe("ExamsList", () => {
	afterEach(() => {
		cleanup();
		navigate.mockClear();
	});

	it("navigates to exam detail when card is clicked", () => {
		render(
			<ExamsList
				exams={[
					{
						id: "exam-1",
						name: "Prova 1",
						questionCount: 5,
						source: null,
						createdAt: "2026-01-15T00:00:00.000Z",
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByText("Prova 1"));

		expect(navigate).toHaveBeenCalledWith({
			to: "/exams/$examId",
			params: { examId: "exam-1" },
		});
	});
});
