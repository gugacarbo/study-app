import { describe, expect, it } from "vitest";
import {
	createIngestPipelineReducer,
	ingestPipelineReducerHandlers,
} from "@/features/ai/pipeline/client/ingest-pipeline-reducer";

describe("ingest-pipeline-reducer", () => {
	it("updates stages, progress, agent runs, and result", () => {
		const reducer = createIngestPipelineReducer();
		const handlers = ingestPipelineReducerHandlers(reducer);

		handlers.onStage?.(
			{ jobError: null, receivedResult: false },
			{
				stageId: "review",
				label: "Review",
				status: "running",
				timestamp: 1,
			},
		);
		handlers.onProgress?.(
			{ jobError: null, receivedResult: false },
			{ step: "Reviewing", percent: 25, stageId: "review" },
		);
		handlers.onAgentRun?.(
			{ jobError: null, receivedResult: false },
			{
				agentRunId: "review-1",
				stageId: "review",
				label: "Reviewer",
				eventType: "lifecycle",
				timestamp: 2,
				status: "pending",
				systemPrompt: "sys",
				userPrompt: "user",
			},
		);
		handlers.onAgentRun?.(
			{ jobError: null, receivedResult: false },
			{
				agentRunId: "review-1",
				stageId: "review",
				label: "Reviewer",
				eventType: "token",
				timestamp: 3,
				rawText: "Done",
				meta: { kind: "text" },
			},
		);
		handlers.onResult?.(
			{ jobError: null, receivedResult: true },
			{ questions: 4, topics: ["math"] },
		);

		const state = reducer.getState();
		expect(state.stages).toEqual([
			expect.objectContaining({ stageId: "review", status: "running" }),
		]);
		expect(state.stepText).toBe("Reviewing");
		expect(state.progress).toBe(25);
		expect(state.agentRuns).toHaveLength(1);
		expect(state.agentRuns[0]).toMatchObject({
			id: "review-1",
			outputText: "Done",
			stageId: "review",
		});
		expect(state.result).toEqual({ questions: 4, topics: ["math"] });
	});

	it("tracks multiple stages and updates existing stage entries", () => {
		const reducer = createIngestPipelineReducer();
		const handlers = ingestPipelineReducerHandlers(reducer);

		handlers.onStage?.(
			{ jobError: null, receivedResult: false },
			{
				stageId: "extract",
				label: "Extract",
				status: "running",
				timestamp: 1,
			},
		);
		handlers.onStage?.(
			{ jobError: null, receivedResult: false },
			{
				stageId: "review",
				label: "Review",
				status: "running",
				timestamp: 2,
			},
		);
		handlers.onStage?.(
			{ jobError: null, receivedResult: false },
			{
				stageId: "extract",
				label: "Extract",
				status: "done",
				timestamp: 3,
			},
		);

		const state = reducer.getState();
		expect(state.stages).toHaveLength(2);
		expect(state.stages[0]).toMatchObject({
			stageId: "extract",
			status: "done",
		});
		expect(state.stages[1]).toMatchObject({
			stageId: "review",
			status: "running",
		});
	});

	it("collects agent warnings and stage error metadata", () => {
		const reducer = createIngestPipelineReducer();
		const handlers = ingestPipelineReducerHandlers(reducer);

		handlers.onStage?.(
			{ jobError: null, receivedResult: false },
			{
				stageId: "review",
				label: "Review",
				status: "error",
				timestamp: 1,
				meta: { error: "All reviewers failed" },
			},
		);
		handlers.onAgentRun?.(
			{ jobError: null, receivedResult: false },
			{
				agentRunId: "review-1",
				stageId: "review",
				label: "Reviewer",
				eventType: "warning",
				timestamp: 2,
				warning: "Skipped invalid option",
			},
		);
		reducer.applyWarning("Batch completed with warnings");

		const state = reducer.getState();
		expect(state.stages[0]).toMatchObject({
			stageId: "review",
			status: "error",
			meta: { error: "All reviewers failed" },
		});
		expect(state.warnings).toEqual([
			"Skipped invalid option",
			"Batch completed with warnings",
		]);
	});

	it("keeps independent agent runs across stages", () => {
		const reducer = createIngestPipelineReducer();
		const handlers = ingestPipelineReducerHandlers(reducer);

		for (const [agentRunId, stageId, label, text] of [
			["extract-1", "extract", "Extractor", "Q1"],
			["review-1", "review", "Reviewer", "Fixed Q1"],
		] as const) {
			handlers.onAgentRun?.(
				{ jobError: null, receivedResult: false },
				{
					agentRunId,
					stageId,
					label,
					eventType: "lifecycle",
					timestamp: 1,
					status: "pending",
					systemPrompt: "sys",
					userPrompt: "user",
				},
			);
			handlers.onAgentRun?.(
				{ jobError: null, receivedResult: false },
				{
					agentRunId,
					stageId,
					label,
					eventType: "token",
					timestamp: 2,
					rawText: text,
					meta: { kind: "text" },
				},
			);
		}

		const state = reducer.getState();
		expect(state.agentRuns).toHaveLength(2);
		expect(state.agentRuns[0]).toMatchObject({
			id: "extract-1",
			stageId: "extract",
			outputText: "Q1",
		});
		expect(state.agentRuns[1]).toMatchObject({
			id: "review-1",
			stageId: "review",
			outputText: "Fixed Q1",
		});
	});
});
