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

export function shouldDisableChatListToolAfterResult(
	toolName: string,
	output: unknown,
): boolean {
	if (!isChatReadOnlyListTool(toolName)) return false;

	const record = readToolOutput(output);
	if (record?.error?.code === CHAT_DUPLICATE_TOOL_CALL_CODE) {
		return true;
	}
	if (record?.error?.code === CHAT_TOOL_CALL_LIMIT_CODE) {
		return true;
	}
	if (record?.ok !== true) return false;

	const hasNextPage = readPaginatedHasNextPage(output);
	return hasNextPage !== true;
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
