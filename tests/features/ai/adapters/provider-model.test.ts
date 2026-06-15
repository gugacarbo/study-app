import { describe, expect, it } from "vitest";
import {
	injectModelRequestBody,
	injectThinkingIntoBody,
} from "#/features/ai/adapters/provider-model";

describe("injectModelRequestBody", () => {
	it("merges request params into JSON request bodies", () => {
		expect(
			injectModelRequestBody(JSON.stringify({ model: "openai/gpt-4o-mini" }), {
				requestParams: { temperature: 0.2 },
			}),
		).toBe(
			JSON.stringify({ temperature: 0.2, model: "openai/gpt-4o-mini" }),
		);
	});

	it("lets explicit request body fields override model params", () => {
		expect(
			injectModelRequestBody(
				JSON.stringify({ model: "openai/gpt-4o-mini", temperature: 0.9 }),
				{ requestParams: { temperature: 0.2 } },
			),
		).toBe(
			JSON.stringify({
				temperature: 0.9,
				model: "openai/gpt-4o-mini",
			}),
		);
	});

	it("applies thinking after request params and body merge", () => {
		expect(
			injectModelRequestBody(JSON.stringify({ model: "minimax/m2" }), {
				requestParams: { temperature: 0.2 },
				thinkingEnabled: true,
			}),
		).toBe(
			JSON.stringify({
				temperature: 0.2,
				model: "minimax/m2",
				thinking: true,
			}),
		);
	});

	it("leaves non-JSON bodies untouched", () => {
		expect(
			injectModelRequestBody("not-json", {
				requestParams: { temperature: 0.2 },
			}),
		).toBe("not-json");
	});
});

describe("injectThinkingIntoBody", () => {
	it("adds a boolean thinking field to JSON request bodies", () => {
		expect(
			injectThinkingIntoBody(JSON.stringify({ model: "minimax/m2" }), true),
		).toBe(JSON.stringify({ model: "minimax/m2", thinking: true }));
	});

	it("preserves false when explicitly configured", () => {
		expect(
			injectThinkingIntoBody(
				JSON.stringify({ model: "minimax/m2", thinking: true }),
				false,
			),
		).toBe(JSON.stringify({ model: "minimax/m2", thinking: false }));
	});

	it("leaves non-JSON bodies untouched", () => {
		expect(injectThinkingIntoBody("not-json", true)).toBe("not-json");
	});
});
