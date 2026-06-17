import type { ToolSet } from "ai";
import { z } from "zod";
import { listAttemptsInputSchema } from "@/features/ai/tools/db-tools/attempt-tools";
import { listExamsInputSchema } from "@/features/ai/tools/db-tools/exam-tools";
import { listAnswerKeysInputSchema } from "@/features/ai/tools/db-tools/question-keys-tools";
import { listQuestionsInputSchema } from "@/features/ai/tools/db-tools/question-list-tools";

export const CHAT_READ_ONLY_LIST_TOOLS = [
	"list_questions",
	"list_exams",
	"list_attempts",
	"list_answer_keys",
] as const;

export type ChatReadOnlyListTool = (typeof CHAT_READ_ONLY_LIST_TOOLS)[number];

/** List tools whose non-empty results mean the user question can be answered. */
export const CHAT_DB_SEARCH_RESULT_TOOLS = [
	"list_questions",
	"list_answer_keys",
] as const;

export type ChatDbSearchResultTool =
	(typeof CHAT_DB_SEARCH_RESULT_TOOLS)[number];

export const CHAT_DUPLICATE_TOOL_CALL_CODE = "DUPLICATE_TOOL_CALL";
export const CHAT_TOOL_CALL_LIMIT_CODE = "TOOL_CALL_LIMIT";

const CHAT_LIST_TOOL_MAX_SUCCESS_CALLS = 3;

const listToolInputSchemas: Record<ChatReadOnlyListTool, z.ZodTypeAny> = {
	list_questions: listQuestionsInputSchema,
	list_exams: listExamsInputSchema,
	list_attempts: listAttemptsInputSchema,
	list_answer_keys: listAnswerKeysInputSchema,
};

function stableSerialize(value: unknown): string {
	try {
		return JSON.stringify(value ?? {});
	} catch {
		return String(value);
	}
}

export function normalizeChatListToolInput(
	toolName: string,
	input: unknown,
): unknown {
	if (!isChatReadOnlyListTool(toolName)) return input;
	const schema = listToolInputSchemas[toolName];
	const parsed = schema.safeParse(input);
	return parsed.success ? parsed.data : input;
}

function buildToolCallSignature(toolName: string, input: unknown): string {
	const normalized = normalizeChatListToolInput(toolName, input);
	return `${toolName}:${stableSerialize(normalized)}`;
}

function readToolOutput(
	output: unknown,
): { ok?: unknown; error?: { code?: string }; data?: unknown } | null {
	if (typeof output !== "object" || output === null) return null;
	return output as {
		ok?: unknown;
		error?: { code?: string };
		data?: unknown;
	};
}

function isSuccessfulDbToolResult(output: unknown): boolean {
	return readToolOutput(output)?.ok === true;
}

function readPaginatedHasNextPage(output: unknown): boolean | undefined {
	const record = readToolOutput(output);
	if (record?.ok !== true) return undefined;
	const data = record.data;
	if (typeof data !== "object" || data === null) return undefined;
	const pagination = (data as { pagination?: { hasNextPage?: unknown } })
		.pagination;
	return typeof pagination?.hasNextPage === "boolean"
		? pagination.hasNextPage
		: undefined;
}

export function readChatListToolItemCount(output: unknown): number | undefined {
	const record = readToolOutput(output);
	if (record?.ok !== true) return undefined;
	const data = record.data;
	if (typeof data !== "object" || data === null) return undefined;

	const items = (data as { items?: unknown }).items;
	if (Array.isArray(items)) return items.length;

	const totalItems = (data as { pagination?: { totalItems?: unknown } })
		.pagination?.totalItems;
	return typeof totalItems === "number" ? totalItems : undefined;
}

function isChatDbSearchResultTool(
	name: string,
): name is ChatDbSearchResultTool {
	return (CHAT_DB_SEARCH_RESULT_TOOLS as readonly string[]).includes(name);
}

function duplicateToolCallResult(toolName: string) {
	return {
		ok: false as const,
		error: {
			code: CHAT_DUPLICATE_TOOL_CALL_CODE,
			message: `The exact same ${toolName} call was already executed in this turn. Use the previous result to answer the user instead of calling again.`,
		},
	};
}

function listToolCallLimitResult(toolName: string) {
	return {
		ok: false as const,
		error: {
			code: CHAT_TOOL_CALL_LIMIT_CODE,
			message: `Reached the limit of ${CHAT_LIST_TOOL_MAX_SUCCESS_CALLS} ${toolName} calls in this turn. Answer with the data already retrieved.`,
		},
	};
}

function isChatReadOnlyListTool(name: string): name is ChatReadOnlyListTool {
	return (CHAT_READ_ONLY_LIST_TOOLS as readonly string[]).includes(name);
}

function readNormalizedListToolInput(
	toolName: ChatReadOnlyListTool,
	input: unknown,
): Record<string, unknown> {
	const normalized = normalizeChatListToolInput(toolName, input);
	if (typeof normalized !== "object" || normalized === null) return {};
	return normalized as Record<string, unknown>;
}

function hasNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

export type ChatListToolCallRecord = {
	toolName: ChatReadOnlyListTool;
	input: unknown;
	output: unknown;
};

type ChatAgentStepLike = {
	toolResults: Array<{
		toolCallId?: string;
		toolName: string;
		input?: unknown;
		output: unknown;
	}>;
	toolCalls?: Array<{
		toolCallId: string;
		toolName: string;
		input?: unknown;
	}>;
};

export function collectChatListToolCalls(
	steps: Array<ChatAgentStepLike>,
): ChatListToolCallRecord[] {
	const calls: ChatListToolCallRecord[] = [];
	for (const step of steps) {
		const inputByCallId = new Map<string, unknown>();
		for (const toolCall of step.toolCalls ?? []) {
			inputByCallId.set(toolCall.toolCallId, toolCall.input);
		}

		for (const result of step.toolResults) {
			if (!isChatReadOnlyListTool(result.toolName)) continue;
			calls.push({
				toolName: result.toolName,
				input:
					result.input ??
					(result.toolCallId
						? inputByCallId.get(result.toolCallId)
						: undefined),
				output: result.output,
			});
		}
	}
	return calls;
}

export type ChatDbSearchState = {
	topicQuestionsAttempted: boolean;
	topicQuestionsEmpty: boolean;
	textAnswerKeysAttempted: boolean;
	textAnswerKeysEmpty: boolean;
	topicOnlyAnswerKeysAttempted: boolean;
	examsAttempted: boolean;
	examsEmpty: boolean;
	examIdsFromSearch: number[];
	examIdQuestionsAttempted: Set<number>;
};

export function analyzeChatDbSearchState(
	steps: Array<ChatAgentStepLike>,
): ChatDbSearchState {
	const state: ChatDbSearchState = {
		topicQuestionsAttempted: false,
		topicQuestionsEmpty: false,
		textAnswerKeysAttempted: false,
		textAnswerKeysEmpty: false,
		topicOnlyAnswerKeysAttempted: false,
		examsAttempted: false,
		examsEmpty: false,
		examIdsFromSearch: [],
		examIdQuestionsAttempted: new Set<number>(),
	};

	for (const call of collectChatListToolCalls(steps)) {
		const record = readToolOutput(call.output);
		if (record?.ok !== true) continue;

		const itemCount = readChatListToolItemCount(call.output) ?? 0;
		const filters = readNormalizedListToolInput(call.toolName, call.input);

		if (call.toolName === "list_questions") {
			if (typeof filters.examId === "number") {
				state.examIdQuestionsAttempted.add(filters.examId);
			} else {
				state.topicQuestionsAttempted = true;
				if (itemCount > 0) {
					state.topicQuestionsEmpty = false;
				} else if (readPaginatedHasNextPage(call.output) !== true) {
					state.topicQuestionsEmpty = true;
				}
			}
		}

		if (call.toolName === "list_answer_keys") {
			if (hasNonEmptyString(filters.textContains)) {
				state.textAnswerKeysAttempted = true;
				state.textAnswerKeysEmpty = itemCount === 0;
			}
			if (
				hasNonEmptyString(filters.topic) &&
				!hasNonEmptyString(filters.textContains)
			) {
				state.topicOnlyAnswerKeysAttempted = true;
			}
		}

		if (call.toolName === "list_exams" && hasNonEmptyString(filters.nameContains)) {
			state.examsAttempted = true;
			state.examsEmpty = itemCount === 0;
			if (itemCount > 0) {
				const data = record.data;
				if (typeof data === "object" && data !== null) {
					const items = (data as { items?: unknown }).items;
					if (Array.isArray(items)) {
						for (const item of items) {
							if (
								typeof item === "object" &&
								item !== null &&
								typeof (item as { id?: unknown }).id === "number"
							) {
								state.examIdsFromSearch.push((item as { id: number }).id);
							}
						}
					}
				}
			}
		}
	}

	state.examIdsFromSearch = [...new Set(state.examIdsFromSearch)];
	return state;
}

export function chatDbSearchFoundResultsInAllSteps(
	steps: Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>,
): boolean {
	return steps.some((step) => chatDbSearchFoundResultsInStep(step.toolResults));
}

export function chatStepOnlyBlockedListToolResults(
	toolResults: Array<{ toolName: string; output: unknown }>,
): boolean {
	const listResults = toolResults.filter((result) =>
		isChatReadOnlyListTool(result.toolName),
	);
	if (listResults.length === 0) return false;

	return listResults.every((result) => {
		const code = readToolOutput(result.output)?.error?.code;
		return (
			code === CHAT_DUPLICATE_TOOL_CALL_CODE ||
			code === CHAT_TOOL_CALL_LIMIT_CODE
		);
	});
}

/** True when the ordered DB search still has phases the agent should try. */
export function chatDbSearchEscalationPending(
	steps: Array<ChatAgentStepLike>,
): boolean {
	if (chatDbSearchFoundResultsInAllSteps(steps)) return false;

	const state = analyzeChatDbSearchState(steps);

	if (
		state.topicQuestionsAttempted &&
		state.topicQuestionsEmpty &&
		!state.textAnswerKeysAttempted
	) {
		return true;
	}

	if (
		state.topicQuestionsEmpty &&
		state.textAnswerKeysAttempted &&
		state.textAnswerKeysEmpty &&
		!state.examsAttempted
	) {
		return true;
	}

	const remainingExamIds = state.examIdsFromSearch.filter(
		(examId) => !state.examIdQuestionsAttempted.has(examId),
	);
	if (remainingExamIds.length > 0) return true;

	return false;
}

export function chatDbSearchExhausted(
	steps: Array<ChatAgentStepLike>,
): boolean {
	if (chatDbSearchFoundResultsInAllSteps(steps)) return false;

	const calls = collectChatListToolCalls(steps);
	const hasDbSearchCall = calls.some(
		(call) =>
			call.toolName === "list_questions" || call.toolName === "list_answer_keys",
	);
	if (!hasDbSearchCall) return false;

	const state = analyzeChatDbSearchState(steps);
	if (!state.topicQuestionsAttempted || !state.topicQuestionsEmpty) {
		return false;
	}

	const answerKeysPhaseDone = state.textAnswerKeysAttempted;

	if (!answerKeysPhaseDone) return false;
	if (!state.textAnswerKeysEmpty) return false;

	if (state.examIdsFromSearch.length > 0) {
		return state.examIdsFromSearch.every((examId) =>
			state.examIdQuestionsAttempted.has(examId),
		);
	}

	return state.examsAttempted || answerKeysPhaseDone;
}

export type ChatDbSearchEscalationPlan =
	| {
			kind: "tools";
			activeTools: string[];
			toolChoice?: { type: "tool"; toolName: string };
	  }
	| { kind: "force_text" };

export function getChatDbSearchEscalationPlan(
	steps: Array<ChatAgentStepLike>,
	availableToolNames: readonly string[],
	disabledTools: ReadonlySet<string>,
): ChatDbSearchEscalationPlan | null {
	if (chatDbSearchFoundResultsInAllSteps(steps)) return null;

	const calls = collectChatListToolCalls(steps);
	const hasDbSearchCall = calls.some(
		(call) =>
			call.toolName === "list_questions" || call.toolName === "list_answer_keys",
	);
	if (!hasDbSearchCall) return null;

	const pickTools = (candidates: string[]) => {
		const activeTools = candidates.filter(
			(name) =>
				availableToolNames.includes(name) && !disabledTools.has(name),
		);
		return activeTools.length > 0
			? ({ kind: "tools", activeTools } as const)
			: null;
	};

	const state = analyzeChatDbSearchState(steps);

	if (!state.topicQuestionsAttempted) {
		return pickTools(["list_questions"]);
	}

	if (state.topicQuestionsEmpty && !state.textAnswerKeysAttempted) {
		const plan = pickTools(["list_answer_keys"]);
		if (plan) {
			return {
				...plan,
				toolChoice: { type: "tool", toolName: "list_answer_keys" },
			};
		}
	}

	if (
		state.topicQuestionsEmpty &&
		state.textAnswerKeysEmpty &&
		!state.examsAttempted
	) {
		const plan = pickTools(["list_exams"]);
		if (plan) {
			return {
				...plan,
				toolChoice: { type: "tool", toolName: "list_exams" },
			};
		}
	}

	const remainingExamIds = state.examIdsFromSearch.filter(
		(examId) => !state.examIdQuestionsAttempted.has(examId),
	);
	if (remainingExamIds.length > 0) {
		const plan = pickTools(["list_questions"]);
		if (plan) return plan;
	}

	if (chatDbSearchExhausted(steps)) {
		return { kind: "force_text" };
	}

	return null;
}

/** Hide tools from completed escalation phases so the model cannot loop backward. */
export function applyChatDbSearchEscalationDisables(
	steps: Array<ChatAgentStepLike>,
	disabledTools: Set<string>,
): void {
	if (chatDbSearchFoundResultsInAllSteps(steps)) {
		for (const toolName of CHAT_READ_ONLY_LIST_TOOLS) {
			disabledTools.add(toolName);
		}
		return;
	}

	const state = analyzeChatDbSearchState(steps);
	if (state.topicQuestionsAttempted && state.topicQuestionsEmpty) {
		disabledTools.add("list_questions");
	}
}

export function shouldDisableChatListToolAfterResult(
	toolName: string,
	output: unknown,
	input?: unknown,
): boolean {
	if (!isChatReadOnlyListTool(toolName)) return false;

	const record = readToolOutput(output);
	if (record?.error?.code === CHAT_DUPLICATE_TOOL_CALL_CODE) {
		if (toolName === "list_answer_keys") {
			const filters = readNormalizedListToolInput(toolName, input);
			if (
				hasNonEmptyString(filters.topic) &&
				!hasNonEmptyString(filters.textContains)
			) {
				return false;
			}
		}
		return true;
	}
	if (record?.error?.code === CHAT_TOOL_CALL_LIMIT_CODE) {
		return true;
	}
	if (record?.ok !== true) return false;

	const itemCount = readChatListToolItemCount(output);
	if (itemCount == null) return false;

	const filters = readNormalizedListToolInput(toolName, input);

	if (itemCount === 0) {
		if (toolName === "list_questions" && filters.examId == null) {
			const hasNextPage = readPaginatedHasNextPage(output);
			if (hasNextPage !== true) {
				return true;
			}
		}
		if (toolName === "list_answer_keys" && hasNonEmptyString(filters.textContains)) {
			return true;
		}
		if (toolName === "list_exams" && hasNonEmptyString(filters.nameContains)) {
			return true;
		}
		return false;
	}

	const hasNextPage = readPaginatedHasNextPage(output);
	return hasNextPage !== true;
}

export function chatDbSearchFoundResultsInStep(
	toolResults: Array<{ toolName: string; output: unknown }>,
): boolean {
	return toolResults.some((result) => {
		if (!isChatDbSearchResultTool(result.toolName)) return false;
		const itemCount = readChatListToolItemCount(result.output);
		return itemCount != null && itemCount > 0;
	});
}

export function chatTurnHasAssistantText(
	steps: Array<{ text?: string }>,
): boolean {
	return steps.some((step) => (step.text?.trim().length ?? 0) > 0);
}

export function chatDbSearchNeedsTextReply(
	steps: Array<ChatAgentStepLike & { text?: string }>,
): boolean {
	if (chatTurnHasAssistantText(steps)) return false;

	if (chatDbSearchFoundResultsInAllSteps(steps)) return true;

	if (chatDbSearchExhausted(steps)) return true;

	const lastStep = steps.at(-1);
	if (!lastStep) return false;

	if (chatDbSearchEscalationPending(steps)) return false;

	return chatStepOnlyBlockedListToolResults(lastStep.toolResults);
}

export function chatDbListToolUsedSuccessfully(
	toolResults: Array<{ toolName: string; output: unknown }>,
): boolean {
	return toolResults.some(
		(result) =>
			isChatReadOnlyListTool(result.toolName) &&
			readToolOutput(result.output)?.ok === true,
	);
}

/**
 * Prevents chat agents from looping on identical DB list-tool calls within one turn.
 */
export function wrapChatToolsWithCallGuards(tools: ToolSet): ToolSet {
	const usedSignatures = new Set<string>();
	const successfulListToolCounts = new Map<string, number>();
	const wrapped: ToolSet = {};

	for (const [name, toolDef] of Object.entries(tools)) {
		if (!toolDef || typeof toolDef.execute !== "function") {
			wrapped[name] = toolDef;
			continue;
		}

		const originalExecute = toolDef.execute.bind(toolDef);

		wrapped[name] = {
			...toolDef,
			execute: async (input, options) => {
				const signature = buildToolCallSignature(name, input);
				if (usedSignatures.has(signature)) {
					return duplicateToolCallResult(name);
				}
				usedSignatures.add(signature);

				if (isChatReadOnlyListTool(name)) {
					const successCount = successfulListToolCounts.get(name) ?? 0;
					if (successCount >= CHAT_LIST_TOOL_MAX_SUCCESS_CALLS) {
						return listToolCallLimitResult(name);
					}
				}

				const result = await originalExecute(input, options);

				if (
					isChatReadOnlyListTool(name) &&
					isSuccessfulDbToolResult(result)
				) {
					successfulListToolCounts.set(
						name,
						(successfulListToolCounts.get(name) ?? 0) + 1,
					);
				}

				return result;
			},
		};
	}

	return wrapped;
}
