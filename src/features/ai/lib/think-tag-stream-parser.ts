const THINK_OPEN = ["<", "think", ">"].join("");
const THINK_CLOSE_TAGS = [
	["<", "/", "think", ">"].join(""),
	["<", "/", "redacted_thinking", ">"].join(""),
] as const;

export type ThinkStreamSegment = {
	kind: "text" | "reasoning";
	content: string;
};

export type ThinkTagParserState = {
	mode: "text" | "reasoning";
	carry: string;
};

export function createThinkTagParserState(): ThinkTagParserState {
	return { mode: "text", carry: "" };
}

function findEarliestTag(
	lowerText: string,
): { kind: "open" | "close"; index: number; length: number } | null {
	let earliest: { kind: "open" | "close"; index: number; length: number } | null =
		null;

	const openIndex = lowerText.indexOf(THINK_OPEN);
	if (openIndex !== -1) {
		earliest = { kind: "open", index: openIndex, length: THINK_OPEN.length };
	}

	for (const closeTag of THINK_CLOSE_TAGS) {
		const closeIndex = lowerText.indexOf(closeTag);
		if (
			closeIndex !== -1 &&
			(earliest === null || closeIndex < earliest.index)
		) {
			earliest = { kind: "close", index: closeIndex, length: closeTag.length };
		}
	}

	return earliest;
}

function findPartialTagPrefixLength(text: string): number {
	const tags = [THINK_OPEN, ...THINK_CLOSE_TAGS];
	let maxPrefix = 0;

	for (const tag of tags) {
		const maxLen = Math.min(tag.length - 1, text.length);
		for (let len = 1; len <= maxLen; len++) {
			const suffix = text.slice(-len);
			if (tag.toLowerCase().startsWith(suffix.toLowerCase())) {
				maxPrefix = Math.max(maxPrefix, len);
			}
		}
	}

	return maxPrefix;
}

export function parseThinkTagTextDelta(
	delta: string,
	state: ThinkTagParserState,
): ThinkStreamSegment[] {
	const segments: ThinkStreamSegment[] = [];
	let text = `${state.carry}${delta}`;
	state.carry = "";

	while (text.length > 0) {
		const lowerText = text.toLowerCase();
		const tag = findEarliestTag(lowerText);

		if (tag && tag.index > 0) {
			const content = text.slice(0, tag.index);
			if (content.length > 0) {
				segments.push({ kind: state.mode, content });
			}
			text = text.slice(tag.index);
			continue;
		}

		if (tag && tag.index === 0) {
			if (tag.kind === "open" && state.mode === "text") {
				state.mode = "reasoning";
			} else if (tag.kind === "close" && state.mode === "reasoning") {
				state.mode = "text";
			}
			text = text.slice(tag.length);
			continue;
		}

		const partialPrefixLength = findPartialTagPrefixLength(text);
		if (partialPrefixLength > 0) {
			const emitLength = text.length - partialPrefixLength;
			if (emitLength > 0) {
				segments.push({
					kind: state.mode,
					content: text.slice(0, emitLength),
				});
			}
			state.carry = text.slice(emitLength);
			return segments;
		}

		if (text.length > 0) {
			segments.push({ kind: state.mode, content: text });
		}
		return segments;
	}

	return segments;
}

export function flushThinkTagParserState(
	state: ThinkTagParserState,
): ThinkStreamSegment[] {
	if (state.carry.length === 0) {
		return [];
	}

	const segments = [{ kind: state.mode, content: state.carry }];
	state.carry = "";
	return segments;
}
