import { describe, expect, it, vi } from "vitest";
import type { ToolSet } from "ai";
import { createImproveQuestionsWorkspace } from "@/features/ai/tools/improve-questions-tools/workspace";
import { createImproveQuestionsTools } from "@/features/ai/tools/improve-questions-tools/tools";

type ExecutableTool = {
	execute: (
		input: Record<string, unknown>,
		context?: { toolCallId?: string },
	) => Promise<unknown>;
};

function getTool(tools: ToolSet, name: string): ExecutableTool {
	const tool = tools[name] as unknown as ExecutableTool | undefined;
	if (!tool?.execute) throw new Error(`Tool ${name} not found`);
	return tool;
}

describe("improve-questions tools", () => {
	it("notifies onToolExecuted with toolCallId from execution context", async () => {
		const workspace = createImproveQuestionsWorkspace({
			questions: [
				{
					id: 718,
					question: "Sample question?",
					options: ["A", "B", "C", "D", "E"],
					answers: ["A"],
					scoringMode: "exact",
					explanation: "Because A.",
				},
			],
		});
		const onToolExecuted = vi.fn();
		const tools = createImproveQuestionsTools(workspace, { onToolExecuted });
		const getQuestion = getTool(tools, "get_question");

		await getQuestion.execute({ id: 718 }, { toolCallId: "tc-live-718" });

		expect(onToolExecuted).toHaveBeenCalledWith(
			expect.objectContaining({
				toolCallId: "tc-live-718",
				toolName: "get_question",
				output: expect.objectContaining({
					ok: true,
					data: expect.objectContaining({ id: 718 }),
				}),
			}),
		);
	});
});
