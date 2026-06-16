import { describe, expect, it } from "vitest";
import {
	areImproveQuestionsExamViewsEqual,
	selectImproveQuestionsExamViews,
} from "@/features/background-processes/store/improve-questions-selectors";
import type { BackgroundProcessStoreState } from "@/features/background-processes/store/types";
import { improveQuestionsProcessId } from "@/features/background-processes/store/types";

function createState(
	processes: BackgroundProcessStoreState["processes"],
): BackgroundProcessStoreState {
	return {
		processes,
		focusedProcessId: null,
		improveQuestionsBatchByExam: {},
		improveQuestionsUiByExam: {},
		explainQuestionsBatchByExam: {},
		explainQuestionsUiByExam: {},
	};
}

describe("improve-questions selectors", () => {
	it("ignores agentRunState message churn when comparing exam views", () => {
		const baseProcess = {
			kind: "improve-questions" as const,
			id: improveQuestionsProcessId(1),
			status: "running" as const,
			questionId: 1,
			examId: 10,
			originalSnapshot: {
				id: 1,
				exam_id: 10,
				question: "Question?",
				options: ["A", "B"],
				answers: ["A"],
				scoringMode: "exact" as const,
				explanation: "",
				deepExplanation: "",
				topic: "General",
			},
			draftQuestion: {
				id: 1,
				exam_id: 10,
				question: "Question?",
				options: ["A", "B"],
				answers: ["A"],
				scoringMode: "exact" as const,
				explanation: "",
				deepExplanation: "",
				topic: "General",
			},
			agentRunState: {
				agentRunId: "improve-questions-1",
				label: "Improve question",
				status: "running" as const,
				systemPrompt: "system",
				userPrompt: "user",
				outputText: "partial",
				messages: [],
				error: null,
				warnings: [],
			},
			changes: [],
			isStreaming: true,
			streamError: null,
			phase: "running" as const,
		};

		const left = selectImproveQuestionsExamViews(createState([baseProcess]), 10);
		const right = selectImproveQuestionsExamViews(
			createState([
				{
					...baseProcess,
					agentRunState: baseProcess.agentRunState
						? {
								...baseProcess.agentRunState,
								outputText: "partial with more streamed text",
								messages: [
									{
										id: "assistant",
										role: "assistant" as const,
										parts: [{ type: "text" as const, text: "more" }],
									},
								],
							}
						: null,
				},
			]),
			10,
		);

		expect(areImproveQuestionsExamViewsEqual(left, right)).toBe(true);
	});
});
