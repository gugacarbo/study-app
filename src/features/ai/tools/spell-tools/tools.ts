import { type ToolSet, tool, zodSchema } from "ai";
import { z } from "zod";
import { checkTextSpelling } from "./check-text";

const TOOL_ERROR_CODE = "SPELL_CHECK_UNAVAILABLE";
const TOOL_ERROR_MESSAGE =
	"Unable to check spelling right now. Please try again.";

const checkSpellingInputSchema = z.object({
	text: z.string().min(1).max(20_000),
});

export function createSpellTools(): ToolSet {
	return {
		check_spelling: tool({
			description:
				"Check Brazilian Portuguese spelling in a text snippet and return misspelled words with suggestions.",
			inputSchema: zodSchema(checkSpellingInputSchema),
			execute: async (input) => {
				try {
					const result = await checkTextSpelling(input.text);
					return {
						ok: true as const,
						...result,
					};
				} catch (error) {
					console.error("check_spelling failed:", error);
					return {
						ok: false as const,
						error: {
							code: TOOL_ERROR_CODE,
							message: TOOL_ERROR_MESSAGE,
						},
					};
				}
			},
		}),
	};
}
