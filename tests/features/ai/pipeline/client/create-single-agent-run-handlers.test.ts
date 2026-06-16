import { describe, expect, it, vi } from "vitest";
import { createSingleAgentRunHandlers } from "@/features/ai/pipeline/client/create-single-agent-run-handlers";
import { runJobPipeline } from "@/features/ai/pipeline/client/run-job-pipeline";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeAgentRun,
	writeJobResult,
	writeWorkspaceUpdate,
} from "@/features/ai/core/ui-message-job-stream";

function createJobResponse(
	execute: Parameters<typeof createJobUIMessageStream>[0]["execute"],
): Response {
	const stream = createJobUIMessageStream({ execute });
	return createJobUIMessageStreamResponse(stream);
}

describe("createSingleAgentRunHandlers", () => {
	it("updates agent state and forwards domain/result callbacks", async () => {
		const response = createJobResponse(({ writer }) => {
			writeAgentRun(writer, {
				agentRunId: "improve-1",
				stageId: "improve",
				label: "Improve",
				eventType: "lifecycle",
				status: "pending",
				timestamp: 1,
				systemPrompt: "sys",
				userPrompt: "user",
			});
			writeAgentRun(writer, {
				agentRunId: "improve-1",
				stageId: "improve",
				label: "Improve",
				eventType: "token",
				timestamp: 2,
				rawText: "Updated",
				meta: { kind: "text" },
			});
			writeWorkspaceUpdate(writer, {
				question: {
					id: "1",
					question: "Q?",
					options: ["A"],
					answers: ["A"],
				},
				updatedFields: ["question"],
			});
			writeJobResult(writer, { ok: true });
		});

		vi.spyOn(globalThis, "fetch").mockResolvedValue(response.clone());

		const onStateChange = vi.fn();
		const onWorkspaceUpdate = vi.fn();
		const onResult = vi.fn();
		const handlers = createSingleAgentRunHandlers({
			initialState: {
				agentRunId: "improve-1",
				label: "Improve",
				status: "pending",
				systemPrompt: "",
				userPrompt: "",
				outputText: "",
				messages: [],
				error: null,
				warnings: [],
			},
			onStateChange,
			onWorkspaceUpdate,
			onResult,
		});

		await runJobPipeline({
			request: { url: "/api/improve-questions", init: { method: "POST" } },
			handlers,
		});

		expect(onStateChange).toHaveBeenCalled();
		expect(handlers.getState().outputText).toBe("Updated");
		expect(onWorkspaceUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				updatedFields: ["question"],
			}),
		);
		expect(onResult).toHaveBeenCalledWith({ ok: true });
	});
});
