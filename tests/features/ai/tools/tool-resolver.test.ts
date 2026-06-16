import { describe, expect, it, vi } from "vitest";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import type { ToolResolverContext } from "@/features/ai/tools/tool-registry";

function createContext(): ToolResolverContext {
	return {
		queries: {} as ToolResolverContext["queries"],
		providerConfig: {} as ToolResolverContext["providerConfig"],
	};
}

describe("resolveToolsForAgent", () => {
	it("includes check_spelling for improve_questions by default", () => {
		const resolved = resolveToolsForAgent({
			agent: "improve_questions",
			config: {},
			context: createContext(),
		});

		expect(resolved.tools.check_spelling).toBeDefined();
		expect(resolved.enabled).toContain("spell_tools");
	});

	it("omits check_spelling when spell_tools is explicitly disabled", () => {
		const onWarning = vi.fn();
		const resolved = resolveToolsForAgent({
			agent: "improve_questions",
			config: { "agent.improve_questions.tools": "web_tools" },
			context: { ...createContext(), onWarning },
		});

		expect(resolved.tools.check_spelling).toBeUndefined();
		expect(resolved.enabled).not.toContain("spell_tools");
	});
});
