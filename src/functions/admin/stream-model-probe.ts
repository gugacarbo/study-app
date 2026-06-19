import { streamText } from "ai";
import { createDb } from "@/db/client";
import type { ModelProbeResult } from "@/features/admin/types/model-probe";
import {
	formatProbeError,
	PROBE_MAX_OUTPUT_TOKENS,
	PROBE_PROMPT,
	resolveProbeModel,
} from "@/functions/admin/probe-model-core";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";

function probeErrorResponse(result: ModelProbeResult, status = 400): Response {
	return Response.json(result, { status });
}

export async function streamModelProbeHandler(
	modelRowId: string,
	request: Request,
	headers: Headers,
): Promise<Response> {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());

	let modelId: string | undefined;
	try {
		const body = (await request.json()) as { modelId?: string };
		modelId = body.modelId?.trim() || undefined;
	} catch {
		modelId = undefined;
	}

	const resolved = await resolveProbeModel(db, session.user.id, {
		id: modelRowId,
		modelId,
	});
	if (!resolved.ok) {
		const status =
			resolved.result.response.error === "Modelo não encontrado" ? 404 : 400;
		return probeErrorResponse(resolved.result, status);
	}

	try {
		const result = streamText({
			model: resolved.probe.model,
			prompt: PROBE_PROMPT,
			maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		return probeErrorResponse({
			ok: false,
			request: resolved.probe.request,
			response: formatProbeError(error),
		});
	}
}
