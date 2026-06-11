export const SUSTAINED_TEXT_MIN_CHARS = 80;

export type BenchmarkToolCallRecord = {
	name: string;
	input?: unknown;
	output?: unknown;
};

export type BenchmarkPhaseId =
	| "text_baseline"
	| "tool_math"
	| "tool_echo"
	| "sustained_text";

export function validateBenchmarkPhase(
	phaseId: BenchmarkPhaseId,
	response: string,
	toolCalls: BenchmarkToolCallRecord[],
): boolean {
	const trimmed = response.trim();

	switch (phaseId) {
		case "text_baseline":
			return trimmed.length > 0;

		case "tool_math": {
			const usedAddNumbers = toolCalls.some(
				(call) => call.name === "add_numbers",
			);
			return usedAddNumbers && trimmed.includes("42");
		}

		case "tool_echo": {
			const usedEcho = toolCalls.some((call) => call.name === "echo");
			return usedEcho && /benchmark/i.test(trimmed);
		}

		case "sustained_text":
			return trimmed.length >= SUSTAINED_TEXT_MIN_CHARS;

		default:
			return false;
	}
}
