import { describe, expect, it } from "vitest";
import { readModelId } from "@/routes/api/chat/-handlers";

describe("readModelId", () => {
	it("returns null when modelId is missing", () => {
		expect(readModelId({})).toBeNull();
	});

	it("returns null for non-numeric values", () => {
		expect(readModelId({ modelId: "1" })).toBeNull();
		expect(readModelId({ modelId: null })).toBeNull();
		expect(readModelId({ modelId: true })).toBeNull();
	});

	it("returns null for invalid numbers", () => {
		expect(readModelId({ modelId: 0 })).toBeNull();
		expect(readModelId({ modelId: -1 })).toBeNull();
		expect(readModelId({ modelId: Number.NaN })).toBeNull();
		expect(readModelId({ modelId: Number.POSITIVE_INFINITY })).toBeNull();
	});

	it("reads modelId from body", () => {
		expect(readModelId({ modelId: 7 })).toBe(7);
	});

	it("reads modelId from forwardedProps when body is missing", () => {
		expect(readModelId({ forwardedProps: { modelId: 12 } })).toBe(12);
	});

	it("reads modelId from metadata as fallback", () => {
		expect(readModelId({ metadata: { modelId: 42 } })).toBe(42);
	});

	it("prefers body modelId over forwardedProps and metadata", () => {
		expect(
			readModelId({
				modelId: 1,
				forwardedProps: { modelId: 2 },
				metadata: { modelId: 3 },
			}),
		).toBe(1);
	});
});
