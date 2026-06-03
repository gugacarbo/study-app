import type { QuizSessionData } from "./types";

export function buildWebResearchContent(data: {
	query: string;
	summary: string;
	sources: string[];
	conclusion?: string;
	topic?: string | null;
	context?: "chat" | "ingest" | "reviewer";
	timestamp: string;
}): string {
	const uniqueSources = Array.from(
		new Set(data.sources.map((s) => s.trim()).filter(Boolean)),
	);

	return `---
type: web-research
context: ${data.context ?? "chat"}
query: ${data.query}
timestamp: ${data.timestamp}
sources: ${uniqueSources.length}
topic: ${data.topic ?? "General"}
---

# Web Research

## Query
${data.query}

## Summary
${data.summary || "No summary provided."}

## Conclusion
${data.conclusion || "Best-effort evidence collected from web tools."}

## Sources
${uniqueSources.map((source) => `- ${source}`).join("\n") || "- none"}
`;
}

export function buildStatsContent(
	stats: {
		totalAttempts: number;
		correctAnswers: number;
		answeredQuestions: number;
		topics: Array<{
			topic: string;
			attempts: number;
			completedAnswers: number;
			correctAnswers: number;
			accuracy: number;
		}>;
	},
	date: string,
): string {
	const overallAccuracy =
		stats.answeredQuestions > 0
			? Math.round((stats.correctAnswers / stats.answeredQuestions) * 100)
			: 0;

	const topicRows = stats.topics
		.map(
			(t) =>
				`| ${t.topic} | ${t.attempts} | ${t.completedAnswers} | ${t.correctAnswers} | ${t.accuracy}% |`,
		)
		.join("\n");

	return `---
type: stats-snapshot
date: ${date}
totalAttempts: ${stats.totalAttempts}
topics: ${stats.topics.length}
---

# Progresso Geral

**Ultima atualizacao:** ${date}
**Total de tentativas:** ${stats.totalAttempts}

## Desempenho por Topico

| Topico | Tentativas | Resp. concluidas | Acertos | Aproveitamento |
|--------|-----------|------------------|---------|---------------|
${topicRows}

## Resumo

- **Topicos estudados:** ${stats.topics.length}
- **Media geral:** ${overallAccuracy}%
`;
}

export function buildInitialProfile(): string {
	return `---
type: learning-profile
created: ${new Date().toISOString().slice(0, 10)}
---

# Learning Profile

## Topics Studied

## Recent Activity

## Strong Areas

## Weak Areas
`;
}

export function updateProfileContent(
	profile: string,
	session: QuizSessionData,
	today: string,
	accuracy: number,
): string {
	let updated = profile;
	const activityLine = `- ${today}: ${session.topic} - ${session.correctAnswers}/${session.totalQuestions} (${accuracy}%)`;
	const topicLine = `- [[${session.topic}]]`;

	if (!updated.includes(`- ${today}: ${session.topic}`)) {
		updated = updated.replace(
			"## Recent Activity",
			`## Recent Activity\n${activityLine}`,
		);
	}
	if (!updated.includes(topicLine)) {
		updated = updated.replace(
			"## Topics Studied",
			`## Topics Studied\n${topicLine}`,
		);
	}
	if (
		accuracy < 60 &&
		!updated.includes(`## Weak Areas\n- [[${session.topic}]]`)
	) {
		updated = updated.replace(
			"## Weak Areas",
			`## Weak Areas\n- [[${session.topic}]]`,
		);
	} else if (
		accuracy >= 80 &&
		!updated.includes(`## Strong Areas\n- [[${session.topic}]]`)
	) {
		updated = updated.replace(
			"## Strong Areas",
			`## Strong Areas\n- [[${session.topic}]]`,
		);
	}
	return updated;
}
