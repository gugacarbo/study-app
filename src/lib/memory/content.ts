import { sessionSlug } from "./r2-operations";
import type { QuizSessionData } from "./types";

export function buildQuizSessionContent(
	session: QuizSessionData,
	date: string,
	accuracy: number,
): string {
	return `---
type: quiz-session
date: ${date}
topic: ${session.topic}
exam: ${session.examName}
total: ${session.totalQuestions}
correct: ${session.correctAnswers}
accuracy: ${accuracy}%
duration: ${session.duration ?? "N/A"}
---

# Quiz Session: ${session.topic}

**Date:** ${date}
**Exam:** ${session.examName}
**Score:** ${session.correctAnswers}/${session.totalQuestions} (${accuracy}%)

## Questions

${session.questions
	.map(
		(q, i) => `### ${i + 1}. ${q.question}

- **Your answer:** ${q.userAnswer}
- **Correct answer:** ${q.correctAnswer}
- **Result:** ${q.isCorrect ? "Correct" : "Incorrect"}
- **Explanation:** ${q.explanation}
- **Topic:** ${q.topic}
`,
	)
	.join("\n")}

## Summary

- **Topics covered:** ${session.topic}
- **Accuracy:** ${accuracy}%
- **Total questions:** ${session.totalQuestions}
`;
}

export function buildTopicNoteContent(
	topic: string,
	content: string,
): { note: string; filePath: string } {
	const slug = sessionSlug(topic);
	const filePath = `memory/topics/${slug}.md`;
	const note = `---
type: topic-notes
topic: ${topic}
updated: ${new Date().toISOString().slice(0, 10)}
---

# ${topic}

${content}
`;
	return { note, filePath };
}

export function buildQuestionBankContent(
	examName: string,
	topic: string,
	questions: Array<{
		question: string;
		options: string[];
		answer: string;
		explanation?: string;
	}>,
): string {
	return `---
type: question-bank
source: ${examName}
topic: ${topic}
exported: ${new Date().toISOString().slice(0, 10)}
total: ${questions.length}
---

# ${examName}

## Questions (${questions.length})

${questions
	.map(
		(q, i) => `### ${i + 1}. ${q.question}

${q.options.map((o, j) => `${String.fromCharCode(97 + j)}) ${o}`).join("\n")}

**Correct answer:** ${q.answer}
${q.explanation ? `**Explanation:** ${q.explanation}` : ""}
`,
	)
	.join("\n")}
`;
}
