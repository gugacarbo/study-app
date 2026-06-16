import { describe, expect, it, vi } from "vitest";
import {
	createReportAgentStageStatusTool,
	INGEST_STAGE_STATUS_TOOL,
	ingestAgentStageStatusInputSchema,
	readIngestAgentStageStatusReport,
	resolveIngestAgentRunStatus,
} from "@/features/ai/tools/ingest-stage-status";

type ExecutableTool = {
	execute: (
		input: Record<string, unknown>,
		context?: { toolCallId?: string },
	) => Promise<unknown>;
};

describe("createReportAgentStageStatusTool", () => {
	it("returns a successful stage report with required message", async () => {
		const onToolExecuted = vi.fn();
		const tools = createReportAgentStageStatusTool({ onToolExecuted });
		const tool = tools[INGEST_STAGE_STATUS_TOOL] as unknown as ExecutableTool;

		const output = await tool.execute(
			{
				status: "success",
				message: "Extracted 3 questions from the source text.",
			},
			{ toolCallId: "tc-stage-1" },
		);

		expect(output).toEqual({
			ok: true,
			status: "success",
			message: "Extracted 3 questions from the source text.",
		});
		expect(onToolExecuted).toHaveBeenCalledWith(
			expect.objectContaining({
				toolCallId: "tc-stage-1",
				toolName: INGEST_STAGE_STATUS_TOOL,
			}),
		);
	});

	it("rejects empty messages in the input schema", () => {
		expect(
			ingestAgentStageStatusInputSchema.safeParse({
				status: "warning",
				message: "   ",
			}).success,
		).toBe(false);
	});
});

describe("resolveIngestAgentRunStatus", () => {
	it("maps a reported success to done", () => {
		expect(
			resolveIngestAgentRunStatus({
				reported: {
					status: "success",
					message: "Review completed with no changes.",
				},
				toolFailureMessages: [],
			}),
		).toEqual({
			status: "done",
			message: "Review completed with no changes.",
		});
	});

	it("escalates cached tool failures when no successful work happened", () => {
		expect(
			resolveIngestAgentRunStatus({
				reported: {
					status: "success",
					message: "Done.",
				},
				toolFailureMessages: ["Question not found"],
				hasSuccessfulWork: false,
			}),
		).toEqual({
			status: "error",
			message: "Question not found",
		});
	});

	it("downgrades reported success to warning when tool errors were cached", () => {
		expect(
			resolveIngestAgentRunStatus({
				reported: {
					status: "success",
					message: "Finished with minor tool issues.",
				},
				toolFailureMessages: ["Validation failed once"],
				hasSuccessfulWork: true,
			}),
		).toEqual({
			status: "warning",
			message: "Finished with minor tool issues.",
		});
	});

	it("falls back when the agent never reported stage status", () => {
		expect(
			resolveIngestAgentRunStatus({
				reported: null,
				toolFailureMessages: [],
				fallbackMessage: "Finished without explicit report.",
			}),
		).toEqual({
			status: "done",
			message: "Finished without explicit report.",
		});
	});
});

describe("readIngestAgentStageStatusReport", () => {
	it("reads a valid tool output payload", () => {
		expect(
			readIngestAgentStageStatusReport({
				ok: true,
				status: "error",
				message: "Could not extract any question.",
			}),
		).toEqual({
			status: "error",
			message: "Could not extract any question.",
		});
	});
});
