import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImproveQuestionsJob } from "@/features/exams/hooks/use-improve-questions-job";
import { ImproveQuestionsConflictError } from "@/features/exams/lib/improve-questions-api";

const createImproveQuestionsJobMock = vi.fn();
const navigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
	};
});

vi.mock("@/features/exams/lib/improve-questions-api", () => ({
	createImproveQuestionsJob: (input: unknown) =>
		createImproveQuestionsJobMock(input),
	ImproveQuestionsConflictError: class ImproveQuestionsConflictError extends Error {
		jobId: string;
		examId: string;
		reason: "active_job" | "pending_review";

		constructor(input: {
			message: string;
			jobId: string;
			examId: string;
			reason: "active_job" | "pending_review";
		}) {
			super(input.message);
			this.name = "ImproveQuestionsConflictError";
			this.jobId = input.jobId;
			this.examId = input.examId;
			this.reason = input.reason;
		}
	},
}));

function MutationProbe({
	onReady,
}: {
	onReady: (mutation: ReturnType<typeof useImproveQuestionsJob>) => void;
}) {
	const mutation = useImproveQuestionsJob();
	onReady(mutation);
	return null;
}

describe("useImproveQuestionsJob", () => {
	afterEach(() => {
		vi.clearAllMocks();
		createImproveQuestionsJobMock.mockReset();
		navigate.mockReset();
	});

	it("returns conflict state and does not navigate when the exam already has a blocking improvement flow", async () => {
		createImproveQuestionsJobMock.mockRejectedValue(
			new ImproveQuestionsConflictError({
				message: "Já existe um processo aguardando aprovação.",
				jobId: "job-1",
				examId: "exam-1",
				reason: "pending_review",
			}),
		);

		let mutation: ReturnType<typeof useImproveQuestionsJob> | null = null;

		render(
			<MutationProbe
				onReady={(value) => {
					mutation = value;
				}}
			/>,
		);

		await waitFor(() => {
			expect(mutation).not.toBeNull();
		});

		let result = false;
		await act(async () => {
			result = await mutation!.submit({
				examId: "exam-1",
				questionIds: ["q-1"],
			});
		});

		expect(result).toBe(false);
		expect(navigate).not.toHaveBeenCalled();
		expect((mutation as unknown as ReturnType<typeof useImproveQuestionsJob>)?.error).toBeNull();
		expect((mutation as unknown as ReturnType<typeof useImproveQuestionsJob>)?.conflict).toMatchObject({
			jobId: "job-1",
			examId: "exam-1",
			reason: "pending_review",
		});
	});

	it("navigates to the created job and clears any previous conflict", async () => {
		createImproveQuestionsJobMock.mockResolvedValue({ jobId: "job-2" });

		let mutation: ReturnType<typeof useImproveQuestionsJob> | null = null;

		render(
			<MutationProbe
				onReady={(value) => {
					mutation = value;
				}}
			/>,
		);

		await waitFor(() => {
			expect(mutation).not.toBeNull();
		});

		let result = false;
		await act(async () => {
			result = await mutation!.submit({
				examId: "exam-1",
				questionIds: ["q-1"],
			});
		});

		expect(result).toBe(true);
		expect(navigate).toHaveBeenCalledWith({
			to: "/jobs/$jobId",
			params: { jobId: "job-2" },
		});
		expect((mutation as unknown as ReturnType<typeof useImproveQuestionsJob>)?.conflict).toBeNull();
		expect((mutation as unknown as ReturnType<typeof useImproveQuestionsJob>)?.error).toBeNull();
	});
});
