import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeleteExam } from "@/features/exams/hooks/use-delete-exam";

const deleteExamMock = vi.fn();

vi.mock("@/functions/exams/delete-exam", () => ({
	deleteExam: ({ data }: { data: unknown }) => deleteExamMock(data),
}));

function MutationProbe({
	onReady,
}: {
	onReady: (mutation: ReturnType<typeof useDeleteExam>) => void;
}) {
	const mutation = useDeleteExam("exam-1");
	onReady(mutation);
	return null;
}

describe("useDeleteExam", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("calls deleteExam and invalidates exam queries on success", async () => {
		deleteExamMock.mockResolvedValue({ success: true });

		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidateSpy = vi.spyOn(client, "invalidateQueries");
		const removeSpy = vi.spyOn(client, "removeQueries");

		let mutation: ReturnType<typeof useDeleteExam> | null = null;

		render(
			<QueryClientProvider client={client}>
				<MutationProbe onReady={(value) => (mutation = value)} />
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(mutation).not.toBeNull();
		});

		await act(async () => {
			await mutation?.mutateAsync();
		});

		expect(deleteExamMock).toHaveBeenCalledWith({ examId: "exam-1" });
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["exams"] });
		expect(removeSpy).toHaveBeenCalledWith({ queryKey: ["exams", "exam-1"] });
	});
});
