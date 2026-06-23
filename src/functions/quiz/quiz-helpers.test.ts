import { describe, expect, it } from "vitest";
import {
	buildAttempt,
	calculateCredit,
	deterministicShuffle,
} from "./quiz-helpers";

describe("calculateCredit", () => {
	it("returns 1 for fully correct exact answer", () => {
		expect(calculateCredit(["A"], ["A"])).toBe(1);
	});

	it("returns 0 for wrong exact answer", () => {
		expect(calculateCredit(["B"], ["A"])).toBe(0);
	});

	it("returns 0.5 for one correct out of two with no incorrect marks", () => {
		expect(calculateCredit(["A"], ["A", "B"])).toBe(0.5);
	});

	it("penalizes incorrect marks in partial scoring", () => {
		expect(calculateCredit(["A", "C"], ["A", "B"])).toBe(0);
	});

	it("floors credit at 0", () => {
		expect(calculateCredit(["C", "D"], ["A", "B"])).toBe(0);
	});

	it("deduplicates selected options before scoring", () => {
		expect(calculateCredit(["A", "A"], ["A"])).toBe(1);
	});

	it("returns 0 when correct set is empty", () => {
		expect(calculateCredit(["A"], [])).toBe(0);
	});
});

describe("calculateFinalScore", () => {
	it("rounds percent correctly", async () => {
		const { calculateFinalScore } = await import("./quiz-helpers");
		expect(calculateFinalScore(1.5, 2)).toBe(75);
		expect(calculateFinalScore(0, 5)).toBe(0);
		expect(calculateFinalScore(2, 3)).toBe(67);
	});
});

describe("deterministicShuffle", () => {
	it("is deterministic for the same seed", () => {
		const rows = ["a", "b", "c", "d", "e"];
		const seed = 12345;
		const first = deterministicShuffle([...rows], seed).join("");
		const second = deterministicShuffle([...rows], seed).join("");
		expect(first).toBe(second);
		expect(first).not.toBe(rows.join(""));
	});

	it("produces different orders for different seeds", () => {
		const rows = ["a", "b", "c", "d", "e"];
		const first = deterministicShuffle([...rows], 1).join("");
		const second = deterministicShuffle([...rows], 2).join("");
		expect(first).not.toBe(second);
	});
});

describe("buildAttempt", () => {
	it("adds a numeric seed to config", () => {
		const result = buildAttempt({
			order: "random",
			quantity: 10,
			topicFilter: null,
			revealMode: "after",
		});
		expect(result.seed).toEqual(expect.any(Number));
		expect(result.config.seed).toBe(result.seed);
	});
});
