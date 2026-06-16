import { type ToolExecutionOptions, type ToolSet, tool, zodSchema } from "ai";
import { z } from "zod";

export const INGEST_STAGE_STATUS_TOOL = "report_agent_stage_status";

const ingestAgentReportedStatusSchema = z.enum([
	"success",
	"warning",
	"error",
	"skipped",
]);

export const ingestAgentStageStatusInputSchema = z.object({
	status: ingestAgentReportedStatusSchema,
	message: z.string().trim().min(1, "Stage status message is required."),
});

export type IngestAgentReportedStatus = z.infer<
	typeof ingestAgentReportedStatusSchema
>;

export type IngestAgentStageStatusReport = z.infer<
	typeof ingestAgentStageStatusInputSchema
>;

export type IngestAgentResolvedStatus =
	| "done"
	| "warning"
	| "error"
	| "skipped";

const ingestAgentStageStatusSuccessSchema = z.object({
	ok: z.literal(true),
	status: ingestAgentReportedStatusSchema,
	message: z.string().min(1),
});

export const INGEST_STAGE_STATUS_COMPLETION_PROMPT = `Completion behavior:
- Before finishing, write a brief plain-text summary (1–3 sentences) of what you accomplished in this stage.
- Then call report_agent_stage_status exactly once with your outcome and a clear message.
- Use status "success" when the stage completed normally, "warning" when work finished with recoverable issues, "error" when the stage failed, and "skipped" when there was nothing meaningful to do.
- The message must explain the outcome for the pipeline; never leave it empty.`;

function mapReportedStatusToAgentStatus(
	status: IngestAgentReportedStatus,
): IngestAgentResolvedStatus {
	switch (status) {
		case "success":
			return "done";
		case "warning":
			return "warning";
		case "error":
			return "error";
		case "skipped":
			return "skipped";
	}
}

export function resolveIngestAgentRunStatus(params: {
	reported: IngestAgentStageStatusReport | null;
	toolFailureMessages: string[];
	hasSuccessfulWork?: boolean;
	fallbackMessage?: string;
}): { status: IngestAgentResolvedStatus; message: string } {
	const {
		reported,
		toolFailureMessages,
		hasSuccessfulWork = true,
		fallbackMessage = "Agent finished without reporting stage status.",
	} = params;

	if (toolFailureMessages.length > 0 && !hasSuccessfulWork) {
		return {
			status: "error",
			message:
				toolFailureMessages[0] ?? "Tool failures blocked stage completion.",
		};
	}

	if (toolFailureMessages.length > 0) {
		const baseStatus = reported
			? mapReportedStatusToAgentStatus(reported.status)
			: "warning";
		const status: IngestAgentResolvedStatus =
			reported?.status === "error"
				? "error"
				: baseStatus === "done"
					? "warning"
					: baseStatus;

		return {
			status,
			message:
				reported?.message ??
				`Completed with tool errors: ${toolFailureMessages.join("; ")}`,
		};
	}

	if (reported) {
		return {
			status: mapReportedStatusToAgentStatus(reported.status),
			message: reported.message,
		};
	}

	return {
		status: "done",
		message: fallbackMessage,
	};
}

export function readIngestAgentStageStatusReport(
	output: unknown,
): IngestAgentStageStatusReport | null {
	if (typeof output !== "object" || output === null) return null;
	const record = output as Record<string, unknown>;
	if (record.ok !== true) return null;

	const parsed = ingestAgentStageStatusInputSchema.safeParse({
		status: record.status,
		message: record.message,
	});
	return parsed.success ? parsed.data : null;
}

export type IngestStageStatusToolEvent = {
	toolCallId: string;
	toolName: typeof INGEST_STAGE_STATUS_TOOL;
	input: IngestAgentStageStatusReport;
	output: z.infer<typeof ingestAgentStageStatusSuccessSchema>;
};

async function notifyStageStatusExecuted(
	options:
		| {
				onToolExecuted?: (
					event: IngestStageStatusToolEvent,
				) => void | Promise<void>;
		  }
		| undefined,
	input: IngestAgentStageStatusReport,
	output: z.infer<typeof ingestAgentStageStatusSuccessSchema>,
	context?: ToolExecutionOptions,
) {
	const toolCallId = context?.toolCallId;
	if (!toolCallId) return;
	await options?.onToolExecuted?.({
		toolCallId,
		toolName: INGEST_STAGE_STATUS_TOOL,
		input,
		output,
	});
}

export function createReportAgentStageStatusTool(options?: {
	onToolExecuted?: (event: IngestStageStatusToolEvent) => void | Promise<void>;
}): ToolSet {
	return {
		[INGEST_STAGE_STATUS_TOOL]: tool({
			description:
				"Report the final outcome of this agent stage. Call once after a brief plain-text summary. Always include a non-empty message.",
			inputSchema: zodSchema(ingestAgentStageStatusInputSchema),
			execute: async (input, context) => {
				const parsedInput = input as IngestAgentStageStatusReport;
				const output = {
					ok: true as const,
					status: parsedInput.status,
					message: parsedInput.message,
				};
				await notifyStageStatusExecuted(options, parsedInput, output, context);
				return output;
			},
		}),
	};
}

export type PipelineAgentReportedStatus = IngestAgentReportedStatus;
export type PipelineStageStatusReport = IngestAgentStageStatusReport;
export type PipelineAgentResolvedStatus = IngestAgentResolvedStatus;

export const PIPELINE_STAGE_STATUS_COMPLETION_PROMPT =
	INGEST_STAGE_STATUS_COMPLETION_PROMPT;

export const resolvePipelineAgentRunStatus = resolveIngestAgentRunStatus;
export const readPipelineStageStatusReport = readIngestAgentStageStatusReport;
