import { describe, expect, it } from "vitest";
import { buildProbeAssistantContent } from "@/features/admin/components/model-test-stream-content";

describe("buildProbeAssistantContent", () => {
	it("keeps plain assistant text as a text part", () => {
		expect(buildProbeAssistantContent("Resposta final")).toEqual([
			{ type: "text", text: "Resposta final" },
		]);
	});

	it("moves think blocks into reasoning parts", () => {
		expect(
			buildProbeAssistantContent(
				"<think>Analisando a pergunta</think>Resposta final",
			),
		).toEqual([
			{ type: "reasoning", text: "Analisando a pergunta" },
			{ type: "text", text: "Resposta final" },
		]);
	});

	it("treats an open think block as streaming reasoning", () => {
		expect(buildProbeAssistantContent("Resposta<think>Rascunho parcial")).toEqual(
			[
				{ type: "text", text: "Resposta" },
				{ type: "reasoning", text: "Rascunho parcial" },
			],
		);
	});
});
