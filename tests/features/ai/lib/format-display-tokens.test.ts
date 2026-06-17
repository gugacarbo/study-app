import { describe, expect, it } from "vitest";
import {
	formatDisplayTokenInOutSummary,
	formatDisplayTokenValue,
	formatDisplayTokens,
} from "@/features/ai/lib/format-display-tokens";

describe("formatDisplayTokens", () => {
	it("shows plain numbers up to 999", () => {
		expect(formatDisplayTokens(0)).toBe("0");
		expect(formatDisplayTokens(999)).toBe("999");
	});

	it("shows one-decimal k between 1.0k and 9.99k", () => {
		expect(formatDisplayTokens(1000)).toBe("1.0k");
		expect(formatDisplayTokens(1500)).toBe("1.5k");
		expect(formatDisplayTokens(9999)).toBe("9.9k");
	});

	it("shows two-decimal k between 10.00k and 19.99k", () => {
		expect(formatDisplayTokens(10_000)).toBe("10.00k");
		expect(formatDisplayTokens(15_500)).toBe("15.50k");
		expect(formatDisplayTokens(19_999)).toBe("19.99k");
	});

	it("shows integer k from 20k to 999k", () => {
		expect(formatDisplayTokens(20_000)).toBe("20k");
		expect(formatDisplayTokens(128_000)).toBe("128k");
		expect(formatDisplayTokens(999_999)).toBe("999k");
	});

	it("shows millions above 1M", () => {
		expect(formatDisplayTokens(1_000_000)).toBe("1.0M");
		expect(formatDisplayTokens(1_500_000)).toBe("1.5M");
		expect(formatDisplayTokens(20_000_000)).toBe("20M");
		expect(formatDisplayTokens(999_000_000)).toBe("999M");
	});

	it("formats in/out summary helper", () => {
		expect(formatDisplayTokenInOutSummary(1200, 800, 2000)).toBe(
			"2.0k (in 1.2k / out 800)",
		);
	});

	it("handles nullable wrapper", () => {
		expect(formatDisplayTokenValue(null)).toBe("—");
		expect(formatDisplayTokenValue(1500)).toBe("1.5k");
	});
});
