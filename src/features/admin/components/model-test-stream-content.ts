type ProbeAssistantContentPart =
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string };

const REASONING_TAGS = ["think", "redacted_thinking"] as const;

function findNextReasoningTag(input: string, startAt: number) {
	let bestMatch:
		| { index: number; tagName: (typeof REASONING_TAGS)[number] }
		| null = null;

	for (const tagName of REASONING_TAGS) {
		const index = input.indexOf(`<${tagName}>`, startAt);
		if (index === -1) continue;
		if (!bestMatch || index < bestMatch.index) {
			bestMatch = { index, tagName };
		}
	}

	return bestMatch;
}

export function buildProbeAssistantContent(
	input: string,
): ProbeAssistantContentPart[] {
	if (!input) return [];

	const parts: ProbeAssistantContentPart[] = [];
	let cursor = 0;

	while (cursor < input.length) {
		const match = findNextReasoningTag(input, cursor);
		if (!match) {
			const text = input.slice(cursor);
			if (text) parts.push({ type: "text", text });
			break;
		}

		const before = input.slice(cursor, match.index);
		if (before) {
			parts.push({ type: "text", text: before });
		}

		const openTag = `<${match.tagName}>`;
		const closeTag = `</${match.tagName}>`;
		const reasoningStart = match.index + openTag.length;
		const closeIndex = input.indexOf(closeTag, reasoningStart);

		if (closeIndex === -1) {
			const reasoning = input.slice(reasoningStart);
			if (reasoning) {
				parts.push({ type: "reasoning", text: reasoning });
			}
			break;
		}

		const reasoning = input.slice(reasoningStart, closeIndex);
		if (reasoning) {
			parts.push({ type: "reasoning", text: reasoning });
		}

		cursor = closeIndex + closeTag.length;
	}

	return parts;
}
