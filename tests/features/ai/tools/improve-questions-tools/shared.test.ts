import { describe, expect, it } from "vitest";
import { getQuestionInputSchema } from "@/features/ai/tools/improve-questions-tools/shared";

describe("getQuestionInputSchema", () => {
	it("accepts numeric ids and coerces string ids", () => {
		expect(getQuestionInputSchema.parse({ id: 715 })).toEqual({ id: 715 });
		expect(getQuestionInputSchema.parse({ id: "715" })).toEqual({ id: 715 });
	});

	it("rejects invalid ids", () => {
		expect(() => getQuestionInputSchema.parse({ id: "abc" })).toThrow();
		expect(() => getQuestionInputSchema.parse({ id: 0 })).toThrow();
	});
});
