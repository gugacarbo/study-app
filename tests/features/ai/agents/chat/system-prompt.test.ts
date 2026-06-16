import { describe, expect, it } from "vitest";
import { buildChatSystemPrompt } from "@/features/ai/agents/chat/system-prompt";

describe("buildChatSystemPrompt", () => {
	it("includes page context block when pageContext is provided", () => {
		const prompt = buildChatSystemPrompt({
			pageContext: {
				contextKey: "exam:42",
				pageType: "exam",
				label: "Prova: Concurso 2024",
				route: "/exams/42",
				examId: "42",
				summary: "120 questões de direito administrativo",
			},
		});

		expect(prompt).toContain("Current page context");
		expect(prompt).toContain("Prova: Concurso 2024");
		expect(prompt).toContain("/exams/42");
		expect(prompt).toContain("Exam ID: 42");
		expect(prompt).toContain("120 questões de direito administrativo");
		expect(prompt).toContain("list_questions");
	});

	it("includes review mode instruction when enabled", () => {
		const prompt = buildChatSystemPrompt({ reviewMode: true });
		expect(prompt).toContain("Review mode is active");
	});
});
