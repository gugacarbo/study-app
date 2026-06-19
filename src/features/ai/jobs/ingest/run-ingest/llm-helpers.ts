export function extractQuestionsFromLlmOutput(value: unknown): unknown[] {
	if (!value || typeof value !== "object" || !("questions" in value)) {
		throw new Error("invalid_llm_output");
	}
	const questions = (value as { questions: unknown }).questions;
	if (!Array.isArray(questions)) {
		throw new Error("invalid_llm_output");
	}
	return questions;
}

export function isTransientLlmError(error: unknown): boolean {
	if (error && typeof error === "object" && "status" in error) {
		const status = Number((error as { status?: number }).status);
		if (status === 429 || status >= 500) {
			return true;
		}
	}
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("timeout") ||
			message.includes("rate limit") ||
			message.includes("429") ||
			message.includes("503") ||
			message.includes("502")
		);
	}
	return false;
}

export function shortErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message.slice(0, 200);
	}
	return "llm_error";
}

export function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
