import { describe, expect, it } from "vitest";
import { estimateThreadTextLength } from "@/features/ai/lib/estimate-thread-text-length";

describe("estimateThreadTextLength", () => {
	it("sums text parts from thread messages", () => {
		expect(
			estimateThreadTextLength([
				{ parts: [{ type: "text", text: "Olá" }] },
				{ parts: [{ type: "text", text: " mundo" }, { type: "tool-call" }] },
			]),
		).toBe(9);
	});

	it("returns 0 for empty input", () => {
		expect(estimateThreadTextLength([])).toBe(0);
		expect(estimateThreadTextLength(undefined)).toBe(0);
	});
});
