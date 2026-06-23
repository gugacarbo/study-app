import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUpdateQuestion } from "@/features/exams/hooks/use-update-question";

const updateQuestionMock = vi.fn();

vi.mock("@/functions/exams/update-question", () => ({
	updateQuestion: ({ data }: { data: unknown }) => updateQuestionMock(data),
}));

function MutationProbe({
	onReady,
}: {
	onReady: (mutation: ReturnType<typeof useUpdateQuestion>) => void;
}) {
	const mutation = useUpdateQuestion("exam-1");
	onReady(mutation);
	return null;
}

describe("useUpdateQuestion", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("calls updateQuestion and invalidates the exam query on success", async () => {
		const questionPayload = {
			examId: "exam-1",
			questionId: "q-1",
			question: "Updated?",
			topic: null,
			scoringMode: "exact" as const,
			options: [{ key: "A", text: "Option A" }],
			answers: ["A"],
			explanation: null,
			deepExplanation: null,
		};

		updateQuestionMock.mockResolvedValue({
			id: "q-1",
			question: "Updated?",
			topic: null,
			scoringMode: "exact",
			options: [{ key: "A", text: "Option A" }],
			answers: ["A"],
			explanation: null,
			deepExplanation: null,
		});

		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidateSpy = vi.spyOn(client, "invalidateQueries");

		let mutation: ReturnType<typeof useUpdateQuestion> | null = null;

		render(
			<QueryClientProvider client={client}>
				<MutationProbe
					onReady={(m) => {
						mutation = m;
					}}
				/>
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(mutation).not.toBeNull();
		});

		await act(async () => {
			await mutation?.mutateAsync(questionPayload);
		});

		expect(updateQuestionMock).toHaveBeenCalledWith(questionPayload);
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["exams", "exam-1"],
		});
	});
});
