import { describe, expect, it } from "vitest";
import { shouldRenderToolGroup } from "@/components/assistant-ui/tool-group";

describe("shouldRenderToolGroup", () => {
	it("does not group up to three sequential tool calls", () => {
		expect(shouldRenderToolGroup(1)).toBe(false);
		expect(shouldRenderToolGroup(2)).toBe(false);
		expect(shouldRenderToolGroup(3)).toBe(false);
	});

	it("groups four or more sequential tool calls", () => {
		expect(shouldRenderToolGroup(4)).toBe(true);
		expect(shouldRenderToolGroup(5)).toBe(true);
	});
});
