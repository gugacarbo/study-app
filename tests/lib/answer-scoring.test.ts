import { describe, expect, it } from "vitest";
import {
	isOptionCorrect,
	normalizeAnswerSet,
	scoreAnswer,
} from "#/lib/answer-scoring";

describe("normalizeAnswerSet", () => {
	it("trims and lowercases values", () => {
		expect([...normalizeAnswerSet(["  Foo ", "BAR"])]).toEqual(["foo", "bar"]);
	});

	it("drops empty strings", () => {
		expect([...normalizeAnswerSet(["", "  ", "a"])]).toEqual(["a"]);
	});
});

describe("isOptionCorrect", () => {
	it("matches option text case-insensitively", () => {
		expect(isOptionCorrect("Option A", ["option a", "option b"])).toBe(true);
		expect(isOptionCorrect("Option C", ["option a", "option b"])).toBe(false);
	});
});

describe("scoreAnswer exact mode", () => {
	const correct = ["A", "B"];

	it("returns full credit for matching set", () => {
		expect(scoreAnswer(["A", "B"], correct, "exact")).toEqual({
			credit: 1,
			isFullyCorrect: true,
		});
	});

	it("returns zero credit when sets differ", () => {
		expect(scoreAnswer(["A"], correct, "exact")).toEqual({
			credit: 0,
			isFullyCorrect: false,
		});
		expect(scoreAnswer(["A", "C"], correct, "exact")).toEqual({
			credit: 0,
			isFullyCorrect: false,
		});
	});

	it("normalizes casing and whitespace", () => {
		expect(scoreAnswer([" a ", "b"], correct, "exact")).toEqual({
			credit: 1,
			isFullyCorrect: true,
		});
	});
});

describe("scoreAnswer partial mode", () => {
	const correct = ["A", "B", "C"];

	it("returns full credit when all correct and no wrong picks", () => {
		expect(scoreAnswer(["A", "B", "C"], correct, "partial")).toEqual({
			credit: 1,
			isFullyCorrect: true,
		});
	});

	it("applies (hits - misses) / |correct| formula", () => {
		expect(scoreAnswer(["A", "B"], correct, "partial")).toEqual({
			credit: 2 / 3,
			isFullyCorrect: false,
		});
	});

	it("clamps negative credit to zero", () => {
		expect(scoreAnswer(["A", "X", "Y"], correct, "partial")).toEqual({
			credit: 0,
			isFullyCorrect: false,
		});
	});

	it("clamps credit above one", () => {
		expect(scoreAnswer(["A", "B", "C", "D"], correct, "partial")).toEqual({
			credit: 2 / 3,
			isFullyCorrect: false,
		});
	});
});
