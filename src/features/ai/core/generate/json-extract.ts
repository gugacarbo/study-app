import type { OutputSchema } from "./types";
import type { SafeParseCapableSchema } from "./types";
import { isSafeParseCapableSchema } from "./types";

function stripThinkBlocks(content: string): string {
	let result = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
	result = result.replace(/<\/think>/gi, "");
	result = stripUnclosedThinkBlocks(result);
	return result.trim();
}

function stripUnclosedThinkBlocks(content: string): string {
	let result = content;
	const thinkTag = /<think>/i;

	while (true) {
		const match = thinkTag.exec(result);
		if (!match || match.index === undefined) {
			return result;
		}

		const thinkStart = match.index;
		const afterThink = result.slice(thinkStart + match[0].length);
		const jsonStart = findLikelyJsonStart(afterThink);

		if (jsonStart === -1) {
			result = `${result.slice(0, thinkStart)}${afterThink}`;
			continue;
		}

		result = `${result.slice(0, thinkStart)}${afterThink.slice(jsonStart)}`;
	}
}

function findLikelyJsonStart(content: string): number {
	const candidates = [
		content.indexOf("{"),
		content.search(/"[^"]+"\s*:/),
		content.indexOf("["),
	].filter((index) => index >= 0);

	return candidates.length > 0 ? Math.min(...candidates) : -1;
}

function extractLikelyJson(content: string): string {
	const trimmed = content.trim();
	if (!trimmed) return trimmed;

	const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (codeFenceMatch?.[1]) {
		return codeFenceMatch[1].trim();
	}

	const objectEnd = trimmed.lastIndexOf("}");
	if (objectEnd !== -1 && /^"[^"]+"\s*:/.test(trimmed)) {
		return `{${trimmed.slice(0, objectEnd + 1).trim()}`;
	}

	const objectStart = trimmed.indexOf("{");
	if (objectStart !== -1 && objectEnd > objectStart) {
		return trimmed.slice(objectStart, objectEnd + 1).trim();
	}

	const arrayStart = trimmed.indexOf("[");
	const arrayEnd = trimmed.lastIndexOf("]");
	if (arrayStart !== -1 && arrayEnd > arrayStart) {
		return trimmed.slice(arrayStart, arrayEnd + 1).trim();
	}

	return trimmed;
}

function repairJson(text: string): string {
	let result = text;
	result = result.replace(/,\s*([\]}])/g, "$1");
	result = result.replace(/'([^']*)'/g, (_match, content) => `"${content}"`);
	return result;
}

function tryParseAccumulatedAsJson<T>(
	text: string,
	outputSchema: OutputSchema<T>,
): T | null {
	if (!text) return null;
	const stripped = stripThinkBlocks(text);
	const extracted = extractLikelyJson(stripped);
	const repaired = repairJson(extracted);

	try {
		const parsed = JSON.parse(repaired) as unknown;
		if (isSafeParseCapableSchema<T>(outputSchema)) {
			const schema = outputSchema as SafeParseCapableSchema<T>;
			const validated = schema.safeParse(parsed);
			if (validated.success) {
				return validated.data;
			}
			console.warn(
				"Fallback JSON parsed but schema validation failed. Issues:",
				JSON.stringify(validated.error.issues, null, 2),
			);
			return null;
		}
		return parsed as T;
	} catch (parseError) {
		const preview = text.length > 500 ? `${text.slice(0, 500)}...` : text;
		console.warn(
			"Fallback JSON parsing failed for streamed content.",
			"Accumulated text length:",
			text.length,
			"Parse error:",
			parseError instanceof Error ? parseError.message : parseError,
			"Preview:",
			preview,
		);
		return null;
	}
}

function tryParseFallbackCandidates<T>(
	candidates: string[],
	outputSchema: OutputSchema<T>,
): T | null {
	for (const candidate of candidates) {
		const parsed = tryParseAccumulatedAsJson<T>(candidate, outputSchema);
		if (parsed !== null) {
			return parsed;
		}
	}

	return null;
}

export { extractLikelyJson, stripThinkBlocks, tryParseFallbackCandidates };
