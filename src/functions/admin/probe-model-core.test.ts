import { describe, expect, it } from "vitest";
import { buildProbeProviderOptions } from "@/functions/admin/probe-model-core";

describe("buildProbeProviderOptions", () => {
	it("maps toggle thinking values to OpenAI reasoning effort values", () => {
		expect(buildProbeProviderOptions("on")).toEqual({
			openai: {
				reasoningEffort: "minimal",
			},
		});

		expect(buildProbeProviderOptions("off")).toEqual({
			openai: {
				reasoningEffort: "none",
			},
		});
	});

	it("preserves explicit reasoning levels", () => {
		expect(buildProbeProviderOptions("high")).toEqual({
			openai: {
				reasoningEffort: "high",
			},
		});
	});

	it("omits provider options for blank or unsupported values", () => {
		expect(buildProbeProviderOptions("")).toBeUndefined();
		expect(buildProbeProviderOptions("  ")).toBeUndefined();
		expect(buildProbeProviderOptions("turbo")).toBeUndefined();
	});
});
