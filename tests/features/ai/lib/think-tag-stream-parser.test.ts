import { describe, expect, it } from "vitest";
import {
	createThinkTagParserState,
	flushThinkTagParserState,
	parseThinkTagTextDelta,
} from "@/features/ai/lib/think-tag-stream-parser";

const THINK_OPEN = ["<", "think", ">"].join("");
const THINK_CLOSE = ["<", "/", "think", ">"].join("");
const REDACTED_CLOSE = ["<", "/", "redacted_thinking", ">"].join("");

function collectSegments(chunks: string[]) {
	const state = createThinkTagParserState();
	const segments = chunks.flatMap((chunk) =>
		parseThinkTagTextDelta(chunk, state),
	);
	segments.push(...flushThinkTagParserState(state));
	return segments;
}

describe("think-tag-stream-parser", () => {
	it("passes plain text through unchanged", () => {
		expect(collectSegments(["Olá! ", "Como posso ajudar?"])).toEqual([
			{ kind: "text", content: "Olá! " },
			{ kind: "text", content: "Como posso ajudar?" },
		]);
	});

	it("splits a complete think block from surrounding text", () => {
		const input = `${THINK_OPEN}reasoning here${THINK_CLOSE}Olá!`;
		expect(collectSegments([input])).toEqual([
			{ kind: "reasoning", content: "reasoning here" },
			{ kind: "text", content: "Olá!" },
		]);
	});

	it("handles think blocks split across chunks", () => {
		const segments = collectSegments([
			THINK_OPEN,
			"step one",
			`${THINK_CLOSE}Hello`,
		]);
		expect(segments).toEqual([
			{ kind: "reasoning", content: "step one" },
			{ kind: "text", content: "Hello" },
		]);
	});

	it("supports redacted_thinking close tags", () => {
		const input = `${THINK_OPEN}hidden${REDACTED_CLOSE}visible`;
		expect(collectSegments([input])).toEqual([
			{ kind: "reasoning", content: "hidden" },
			{ kind: "text", content: "visible" },
		]);
	});

	it("buffers partial closing tags across chunks", () => {
		const state = createThinkTagParserState();
		const first = parseThinkTagTextDelta(
			`${THINK_OPEN}reasoning</thi`,
			state,
		);
		const second = parseThinkTagTextDelta(`nk>answer`, state);
		const trailing = flushThinkTagParserState(state);

		expect(first).toEqual([{ kind: "reasoning", content: "reasoning" }]);
		expect(second).toEqual([{ kind: "text", content: "answer" }]);
		expect(trailing).toEqual([]);
	});

	it("keeps reasoning-only output when no trailing text exists", () => {
		const input = `${THINK_OPEN}only reasoning${THINK_CLOSE}`;
		expect(collectSegments([input])).toEqual([
			{ kind: "reasoning", content: "only reasoning" },
		]);
	});
});
