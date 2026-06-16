import type { ToolSet } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSpellTools } from "@/features/ai/tools/spell-tools/tools";

const { checkTextSpellingMock } = vi.hoisted(() => ({
	checkTextSpellingMock: vi.fn(),
}));

vi.mock("@/features/ai/tools/spell-tools/check-text", () => ({
	checkTextSpelling: checkTextSpellingMock,
}));

type ExecutableTool = {
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: ToolSet, name: string): ExecutableTool {
	const tool = tools[name] as unknown as ExecutableTool | undefined;
	if (!tool?.execute) throw new Error(`Tool ${name} not found`);
	return tool;
}

describe("spell tools", () => {
	beforeEach(() => {
		checkTextSpellingMock.mockReset();
	});

	it("returns spelling issues for misspelled Portuguese text", async () => {
		checkTextSpellingMock.mockResolvedValue({
			language: "pt-BR",
			checkedWordCount: 1,
			issues: [{ word: "ortogafia", suggestions: ["ortografia"] }],
		});

		const tools = createSpellTools();
		const checkSpelling = getTool(tools, "check_spelling");
		const output = await checkSpelling.execute({ text: "ortogafia" });

		expect(output).toEqual({
			ok: true,
			language: "pt-BR",
			checkedWordCount: 1,
			issues: [{ word: "ortogafia", suggestions: ["ortografia"] }],
		});
	});

	it("returns an empty issue list when spelling is correct", async () => {
		checkTextSpellingMock.mockResolvedValue({
			language: "pt-BR",
			checkedWordCount: 1,
			issues: [],
		});

		const tools = createSpellTools();
		const checkSpelling = getTool(tools, "check_spelling");
		const output = await checkSpelling.execute({ text: "Brasília" });

		expect(output).toEqual({
			ok: true,
			language: "pt-BR",
			checkedWordCount: 1,
			issues: [],
		});
	});

	it("returns a structured error when spell checking is unavailable", async () => {
		checkTextSpellingMock.mockRejectedValue(new Error("dictionary unavailable"));

		const tools = createSpellTools();
		const checkSpelling = getTool(tools, "check_spelling");
		const output = await checkSpelling.execute({ text: "ortogafia" });

		expect(output).toEqual({
			ok: false,
			error: {
				code: "SPELL_CHECK_UNAVAILABLE",
				message: "Unable to check spelling right now. Please try again.",
			},
		});
	});
});
