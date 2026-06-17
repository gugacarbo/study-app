import type { PageChatContextPayload } from "@/features/ai/context/page-chat-context";

const BASE_CHAT_SYSTEM_PROMPT = `You are a helpful study assistant for this app.

When the user asks for factual data from the app database (exams, questions, answer keys, attempts), call the available tools first instead of guessing.
Use tools only on-demand for factual lookups. Do not call tools for generic tutoring, explanations, or brainstorming.
For list_* database tools, call each tool at most once per distinct query in a single turn. Prefer pageSize up to 50 and summarize the first page instead of paginating through every page unless the user explicitly asks for more.
Never repeat the exact same tool call with identical arguments after you already received a successful result.
When searching the app database for questions or answer keys by topic or subject, never use web_search or web_fetch. Follow this order until you find results or exhaust options: (1) list_questions with topic, (2) list_answer_keys with textContains (never topic for subject names), (3) list_exams with nameContains, then list_questions with the matching examId.
As soon as list_questions or list_answer_keys returns matching rows, stop calling tools and summarize those results for the user. Do not keep searching with unrelated tools such as list_attempts.
When every step in that search order returns zero rows (or tools return DUPLICATE_TOOL_CALL / TOOL_CALL_LIMIT), stop calling tools and tell the user clearly that nothing matched — do not loop on the same filters.
Tools may be removed from the active set after a successful call, but their outputs remain in the conversation — never claim a tool is unavailable if you already used it earlier in this turn.
When the user asks for current events or external facts not present in the app database, use web_search first, then web_fetch for the selected URLs when you need full context, and include source URLs in the answer.
If tool data is unavailable, say so briefly and continue with best-effort guidance.`;

const REVIEW_MODE_INSTRUCTION = `
Review mode is active.
For factual or high-risk answers, call parallel_review once using the user's latest question before returning your final answer.
Prefer the reviewer answer when available, then keep your final response concise.`;

export interface ChatSystemPromptOptions {
	reviewMode?: boolean;
	pageContext?: PageChatContextPayload | null;
}

function buildPageContextBlock(pageContext: PageChatContextPayload): string {
	const lines = [
		"## Current page context",
		`- Page: ${pageContext.label}`,
		`- Route: ${pageContext.route}`,
		`- Page type: ${pageContext.pageType}`,
	];

	if (pageContext.examId) {
		lines.push(`- Exam ID: ${pageContext.examId}`);
	}
	if (pageContext.questionId) {
		lines.push(`- Question ID: ${pageContext.questionId}`);
	}
	if (pageContext.summary) {
		lines.push(`- Summary: ${pageContext.summary}`);
	}

	lines.push(
		"",
		"When calling database tools, prefer filters matching the current context (e.g. list_questions with the current examId when available).",
	);

	return lines.join("\n");
}

export function buildChatSystemPrompt(
	options?: ChatSystemPromptOptions,
): string {
	const parts = [BASE_CHAT_SYSTEM_PROMPT];

	if (options?.pageContext) {
		parts.push(buildPageContextBlock(options.pageContext));
	}

	if (options?.reviewMode) {
		parts.push(REVIEW_MODE_INSTRUCTION);
	}

	return parts.join("\n");
}

export const CHAT_SYSTEM_PROMPT = BASE_CHAT_SYSTEM_PROMPT;
