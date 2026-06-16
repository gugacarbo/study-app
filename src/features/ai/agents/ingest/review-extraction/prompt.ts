import type { Question } from "@/lib/validation";
import { INGEST_STAGE_STATUS_COMPLETION_PROMPT } from "@/features/ai/tools/ingest-stage-status";
import type { ExtractionQuestionId } from "@/features/ai/tools/ingest-tools";
import { formatExtractionQuestionId } from "@/features/ai/tools/ingest-tools";
import { extractQuestionSourceSnippet } from "./source-snippet";

function unique<T>(items: T[]): T[] {
	return Array.from(new Set(items));
}

export function deriveTopics(
	questions: Question[],
	fallbackTopics: string[],
): string[] {
	const questionTopics = questions
		.map((question) => question.topic?.trim())
		.filter((topic): topic is string => Boolean(topic));

	return unique(
		[...questionTopics, ...fallbackTopics.map((topic) => topic.trim())].filter(
			Boolean,
		),
	);
}

function buildReviewerSystemPromptBase(
	workspaceQuestionId: ExtractionQuestionId,
): string {
	return `You are a reviewer for a single extracted exam question.
Your only task is to verify and correct one question object while preserving the original language from the source text.

Tool contract:
- The review workspace already contains this question as questionId "${workspaceQuestionId}". The user prompt includes a full snapshot — do not call list_extracted_questions.
- Use update_extracted_question only when a field actually needs correction.
- Use report_agent_stage_status once at the end to report the review outcome.
- When calling update_extracted_question, always pass questionId "${workspaceQuestionId}" and include only the fields you are changing. Omit unchanged fields entirely — never send null.
- A call with only questionId and no field changes is a no-op.
- Do not return a final JSON object yourself. The server will read the final reviewed question from the workspace.
- Before calling report_agent_stage_status, reply with a brief plain-text summary (1–3 sentences) of what you checked and what you changed, or state that no changes were needed.
- Do not output markdown, code fences, or JSON outside that final summary.

Completion behavior:
- Compare the snapshot and source excerpt in the user prompt against the workspace question.
- After one successful update_extracted_question call, stop calling workspace tools and report the stage status.
- If the question is already correct, report the stage status without calling update_extracted_question.
- Never call update_extracted_question repeatedly in a loop.

${INGEST_STAGE_STATUS_COMPLETION_PROMPT}

Review rules:
- Always keep "options" with at least 2 items. For open-ended questions, include the exact correct answer plus at least one short incorrect distractor.
- Set "answers" to the full option texts of every correct answer. For single-choice MCQ, "answers" has exactly one element.
- For somatória or multi-statement V-F (numbered statements 01/02/04/08/16), each statement is one option and "answers" lists every correct statement's full text.
- When you update a question, set "explanation" to "".
- Do not invent extra fields or speculative corrections.`;
}

export function buildReviewerSystemPrompt(
	reviewTopics: string[],
	workspaceQuestionId: ExtractionQuestionId,
): string {
	const sections = [buildReviewerSystemPromptBase(workspaceQuestionId)];

	if (reviewTopics.length > 0) {
		sections.push(`
Critical topic checks:
- Priority topics for extra care: ${reviewTopics.join(", ")}.
- If you find uncertainty in question/answer pairs for these topics, verify with web_search/web_fetch before applying corrections.
- Keep corrections faithful to the source text and avoid speculative changes.`);
	}

	return sections.join("\n");
}

function formatQuestionSnapshot(question: Question): string[] {
	const options = question.options
		.map((option, optionIndex) => {
			const label = String.fromCharCode(65 + optionIndex);
			return `  ${label}) ${option}`;
		})
		.join("\n");

	return [
		"Extracted question snapshot:",
		`Stem: ${question.question}`,
		"Options:",
		options,
		`Answers: ${question.answers.join("; ")}`,
		`Scoring mode: ${question.scoringMode}`,
		`Topic: ${question.topic?.trim() || "General"}`,
	];
}

export function buildReviewerUserPrompt(
	sourceText: string,
	question: Question,
	index: number,
): string {
	const workspaceQuestionId = formatExtractionQuestionId(index + 1);
	const sourceExcerpt = extractQuestionSourceSnippet(sourceText, question);
	const sourceSection = sourceExcerpt
		? ["Source excerpt for this question only:", sourceExcerpt]
		: [
				"No matching source excerpt was found for this question.",
				"Use the snapshot below as the workspace copy.",
				"Use web_search when a critical-topic check needs external verification.",
			];

	return [
		`Review extracted question #${index + 1}.`,
		`The question already exists in the workspace as questionId "${workspaceQuestionId}".`,
		"",
		"Workflow:",
		`- Compare the snapshot and source excerpt below against the workspace question (questionId "${workspaceQuestionId}").`,
		`- Call update_extracted_question with questionId "${workspaceQuestionId}" only for fields that need correction. Omit unchanged fields; never pass null.`,
		"- If the question is already correct, report the stage status without calling update_extracted_question.",
		"- End with a brief plain-text summary, then call report_agent_stage_status.",
		"",
		...formatQuestionSnapshot(question),
		"",
		...sourceSection,
	].join("\n");
}
