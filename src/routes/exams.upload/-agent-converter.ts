import type { UIMessage } from "ai";
import type { IngestAgentRunViewModel } from "@/features/ingest/components/types";
import {
	isRecord,
	normalizeAgentState,
	normalizePartialTokenTotals,
	readNumber,
	readResponseFallback,
	readString,
} from "./-job-view-model-utils";

function createTextMessage(
	id: string,
	role: UIMessage["role"],
	text: string,
): UIMessage {
	return {
		id,
		role,
		parts: [{ type: "text", text }],
	};
}

function normalizeMessageRole(value: unknown): UIMessage["role"] {
	switch (value) {
		case "system":
		case "user":
		case "assistant":
			return value;
		default:
			return "assistant";
	}
}

function stringifyMessageContent(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value ?? "");
	}
}

function normalizeMessagePart(
	part: unknown,
): UIMessage["parts"][number] | null {
	if (!isRecord(part)) return null;
	const type = readString(part.type);
	if (!type) return null;

	if (type === "text") {
		return {
			type: "text",
			text: readString(part.content) ?? readString(part.text) ?? "",
		};
	}

	if (type === "thinking" || type === "reasoning") {
		return {
			type: "reasoning",
			text: readString(part.content) ?? readString(part.text) ?? "",
		};
	}

	if (type === "dynamic-tool") {
		return {
			type: "dynamic-tool",
			toolCallId:
				readString(part.toolCallId) ??
				readString(part.id) ??
				`${crypto.randomUUID()}:tool-call`,
			toolName:
				readString(part.toolName) ?? readString(part.name) ?? "unknown_tool",
			input: part.input,
			output: part.output,
			errorText: readString(part.errorText) ?? readString(part.error),
			state:
				part.state === "input-streaming" ||
				part.state === "input-available" ||
				part.state === "approval-requested" ||
				part.state === "approval-responded" ||
				part.state === "output-available" ||
				part.state === "output-error" ||
				part.state === "output-denied"
					? part.state
					: "input-available",
		} as UIMessage["parts"][number];
	}

	if (type === "tool-call") {
		return {
			type: "dynamic-tool",
			toolCallId:
				readString(part.id) ??
				`${readString(part.name) ?? "tool"}:${crypto.randomUUID()}`,
			toolName: readString(part.name) ?? "unknown_tool",
			input: part.input ?? tryParseJson(readString(part.arguments)),
			output: part.output,
			state: "input-available",
		} as UIMessage["parts"][number];
	}

	if (type === "tool-result") {
		return {
			type: "dynamic-tool",
			toolCallId:
				readString(part.toolCallId) ??
				readString(part.id) ??
				`${crypto.randomUUID()}:tool-call`,
			toolName: "unknown_tool",
			input: {},
			output: tryParseJson(stringifyMessageContent(part.content)),
			errorText: readString(part.error),
			state: part.state === "error" ? "output-error" : "output-available",
		} as UIMessage["parts"][number];
	}

	return part as UIMessage["parts"][number];
}

function tryParseJson(value: string | undefined): unknown {
	if (!value) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function readMessages(value: unknown, agentId: string): UIMessage[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((entry, index) => {
			if (!isRecord(entry)) return null;
			const role = normalizeMessageRole(entry.role);
			const parts = Array.isArray(entry.parts)
				? entry.parts
						.map((part) => normalizeMessagePart(part))
						.filter((part): part is UIMessage["parts"][number] => part != null)
				: [];
			return {
				id: readString(entry.id) ?? `${agentId}:message:${index}`,
				role,
				parts:
					parts.length > 0
						? parts
						: [
								createTextMessage(`${agentId}:${role}:${index}`, role, "")
									.parts[0],
							],
			} satisfies UIMessage;
		})
		.filter((message): message is UIMessage => message != null);
}

function readRoleText(
	messages: UIMessage[],
	role: UIMessage["role"],
): string | undefined {
	const message = messages.find((candidate) => candidate.role === role);
	if (!message) return undefined;
	const text = message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
	return text.length > 0 ? text : undefined;
}

function buildFallbackMessages(
	id: string,
	systemPrompt: string | undefined,
	userPrompt: string | undefined,
	response: string | undefined,
): UIMessage[] {
	return [
		createTextMessage(`${id}:system`, "system", systemPrompt ?? ""),
		createTextMessage(`${id}:user`, "user", userPrompt ?? ""),
		createTextMessage(`${id}:assistant`, "assistant", response ?? ""),
	];
}

export function toAgentRun(value: unknown): IngestAgentRunViewModel | null {
	if (!isRecord(value)) return null;
	const id =
		readString(value.id) ?? readString(value.agentId) ?? crypto.randomUUID();
	const stageId = readString(value.stageId);
	const name =
		readString(value.name) ??
		readString(value.agentName) ??
		readString(value.label);
	if (!stageId || !name) return null;
	const messages = readMessages(value.messages, id);
	const systemPrompt =
		readString(value.systemPrompt) ??
		readString(value.system) ??
		readString(value.prompt) ??
		readRoleText(messages, "system");
	const userPrompt =
		readString(value.userPrompt) ??
		readString(value.user) ??
		readRoleText(messages, "user");
	const response =
		readRoleText(messages, "assistant") ??
		readString(value.response) ??
		readString(value.output) ??
		readString(value.outputText) ??
		readResponseFallback(value.rawOutput);

	return {
		id,
		stageId,
		name,
		state: normalizeAgentState(value.state ?? value.status),
		summary:
			readString(value.summary) ??
			readString(value.statusText) ??
			readString(value.description) ??
			readString(value.error),
		startedAt: readNumber(value.startedAt) ?? readNumber(value.timestamp),
		updatedAt: readNumber(value.updatedAt) ?? readNumber(value.timestamp),
		finishedAt: readNumber(value.finishedAt),
		systemPrompt,
		userPrompt,
		response,
		messages: (messages.length > 0
			? messages
			: buildFallbackMessages(
					id,
					systemPrompt,
					userPrompt,
					response,
				)) as unknown as IngestAgentRunViewModel["messages"],
		tokens: normalizePartialTokenTotals(value.tokens ?? value.tokenTotals),
		error: readString(value.error),
		raw: {
			payload: value.payload ?? value.rawOutput,
			stream: value.stream ?? value.outputText,
			status: value.status,
			tokens: value.tokens ?? value.tokenTotals,
			error: value.error,
			meta: isRecord(value.meta) ? value.meta : undefined,
		},
	};
}
