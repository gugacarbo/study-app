import type { ToolJSONSchema } from "assistant-stream";
import type { UIMessage } from "ai";
import { z } from "zod";
import { toBoolean } from "./-tools";

const positiveIntSchema = z.number().int().positive();

const uiMessageSchema = z
	.object({
		id: z.string().min(1),
		role: z.enum(["user", "assistant", "system"]),
	})
	.passthrough();

const toolJsonSchema = z.object({
	description: z.string().optional(),
	parameters: z.unknown(),
});

const clientToolArraySchema = z.array(
	z.object({
		name: z.string().min(1),
		description: z.string().optional(),
		parameters: z.unknown(),
	}),
);

const chatRequestSchema = z
	.object({
		messages: z.array(uiMessageSchema).min(1, "messages are required"),
		tools: z
			.union([z.record(z.string(), toolJsonSchema), clientToolArraySchema])
			.optional(),
		forwardedProps: z.record(z.string(), z.unknown()).optional(),
		reviewMode: z.unknown().optional(),
		modelId: positiveIntSchema.optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		conversationId: z.string().min(1).optional(),
	})
	.transform((body) => ({
		messages: body.messages as unknown as UIMessage[],
		tools: body.tools,
		reviewMode: readReviewMode(body),
		modelId: resolveChatModelId(body),
		conversationId: body.conversationId,
		metadata: body.metadata,
	}));

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ParsedClientTools = Record<string, ToolJSONSchema>;

function readOptionalModelId(
	record: Record<string, unknown> | undefined,
): number | null {
	if (!record || !("modelId" in record)) return null;
	const parsed = positiveIntSchema.safeParse(record.modelId);
	return parsed.success ? parsed.data : null;
}

/** Resolves modelId from body, forwardedProps, or metadata (first valid wins). */
export function resolveChatModelId(body: {
	modelId?: number;
	forwardedProps?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}): number | null {
	if (body.modelId) return body.modelId;
	return (
		readOptionalModelId(body.forwardedProps) ??
		readOptionalModelId(body.metadata)
	);
}

/** @deprecated Use resolveChatModelId — kept for existing tests. */
export function readModelId(body: {
	modelId?: unknown;
	forwardedProps?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}): number | null {
	return resolveChatModelId({
		modelId:
			typeof body.modelId === "number" &&
			Number.isFinite(body.modelId) &&
			body.modelId > 0 &&
			Number.isInteger(body.modelId)
				? body.modelId
				: undefined,
		forwardedProps: body.forwardedProps,
		metadata: body.metadata,
	});
}

function readReviewMode(body: {
	reviewMode?: unknown;
	forwardedProps?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}): boolean {
	return toBoolean(
		body.reviewMode ??
			body.forwardedProps?.reviewMode ??
			body.metadata?.reviewMode,
	);
}

export function parseClientToolsFromRequest(
	request: Pick<ChatRequest, "tools">,
): ParsedClientTools {
	const tools = request.tools;
	if (!tools) return {};

	if (Array.isArray(tools)) {
		return Object.fromEntries(
			tools.map((tool) => [
				tool.name,
				{
					...(tool.description !== undefined
						? { description: tool.description }
						: {}),
					parameters: tool.parameters as ToolJSONSchema["parameters"],
				},
			]),
		);
	}

	return tools as ParsedClientTools;
}

export function parseChatRequest(
	payload: unknown,
):
	| { ok: true; data: ChatRequest }
	| { ok: false; response: Response } {
	if (payload === null || typeof payload !== "object") {
		return {
			ok: false,
			response: new Response("Invalid chat request body", { status: 400 }),
		};
	}

	if (
		"messages" in payload &&
		Array.isArray(payload.messages) &&
		payload.messages.length === 0
	) {
		return {
			ok: false,
			response: new Response("messages are required", { status: 400 }),
		};
	}

	const parsed = chatRequestSchema.safeParse(payload);
	if (!parsed.success) {
		const details = parsed.error.issues.map((issue) => ({
			path: issue.path.join("."),
			message: issue.message,
		}));

		return {
			ok: false,
			response: new Response(
				JSON.stringify({
					error: "Invalid chat request",
					details,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			),
		};
	}

	return { ok: true, data: parsed.data };
}
