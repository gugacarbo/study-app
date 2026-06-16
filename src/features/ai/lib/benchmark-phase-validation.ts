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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function extractNumericValue(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.length === 0) return null;

		const asNumber = Number(trimmed);
		if (Number.isFinite(asNumber)) {
			return asNumber;
		}

		try {
			return extractNumericValue(JSON.parse(trimmed));
		} catch {
			const matched = trimmed.match(/-?\d+(?:\.\d+)?/);
			if (!matched) return null;
			const parsed = Number(matched[0]);
			return Number.isFinite(parsed) ? parsed : null;
		}
	}

	if (isRecord(value)) {
		if ("sum" in value) {
			return extractNumericValue(value.sum);
		}
		if ("result" in value) {
			return extractNumericValue(value.result);
		}
		if ("value" in value) {
			return extractNumericValue(value.value);
		}
	}

	return null;
}

function hasStageStatusReport(toolCalls: BenchmarkToolCallRecord[]): boolean {
	return toolCalls.some((call) => call.name === "report_agent_stage_status");
}

export function validateBenchmarkPhase(
	phaseId: BenchmarkPhaseId,
	response: string,
	toolCalls: BenchmarkToolCallRecord[],
): boolean {
	const trimmed = response.trim();

	if (!hasStageStatusReport(toolCalls)) {
		return false;
	}

	switch (phaseId) {
		case "text_baseline":
			return trimmed.length > 0 && /ready/i.test(trimmed);

		case "tool_math": {
			const addNumbersCalls = toolCalls.filter(
				(call) => call.name === "add_numbers",
			);
			if (addNumbersCalls.length === 0) return false;

			const responseValue = extractNumericValue(trimmed);
			if (responseValue === 42) {
				return true;
			}

			return addNumbersCalls.some(
				(call) => extractNumericValue(call.output) === 42,
			);
		}

		case "tool_echo": {
			const echoCalls = toolCalls.filter((call) => call.name === "echo");
			if (echoCalls.length === 0) return false;
			if (/benchmark/i.test(trimmed)) return true;

			return echoCalls.some((call) => {
				if (isRecord(call.output) && "message" in call.output) {
					return /benchmark/i.test(String(call.output.message));
				}
				return /benchmark/i.test(String(call.output ?? ""));
			});
		}

		case "sustained_text": {
			const bulletLines = trimmed
				.split("\n")
				.filter((line) => /^\s*[-*•]\s+\S/.test(line));
			return (
				bulletLines.length >= 4 || trimmed.length >= SUSTAINED_TEXT_MIN_CHARS
			);
		}

		default:
			return false;
	}
}
