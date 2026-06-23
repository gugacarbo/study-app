import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import {
	applyQuestionImprovementDraft,
	discardQuestionImprovementDraft as discardQuestionImprovementDraftQuery,
	getPendingQuestionImprovementDraftsByExam,
} from "@/db/queries/question-improvement-drafts";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

const getQuestionImprovementDraftsSchema = z.object({
	examId: z.string().uuid(),
});

const mutateQuestionImprovementDraftSchema = z.object({
	draftId: z.string().uuid(),
});

export async function getQuestionImprovementDraftsHandler(
	input: z.infer<typeof getQuestionImprovementDraftsSchema>,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	return getPendingQuestionImprovementDraftsByExam(
		db,
		input.examId,
		session.user.id,
	);
}

export async function approveQuestionImprovementDraftHandler(
	input: z.infer<typeof mutateQuestionImprovementDraftSchema>,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	const ok = await applyQuestionImprovementDraft(db, {
		draftId: input.draftId,
		userId: session.user.id,
	});
	if (!ok) {
		throw new Response("Not Found", { status: 404 });
	}
	return { ok: true as const };
}

export async function discardQuestionImprovementDraftHandler(
	input: z.infer<typeof mutateQuestionImprovementDraftSchema>,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	const ok = await discardQuestionImprovementDraftQuery(db, {
		draftId: input.draftId,
		userId: session.user.id,
	});
	if (!ok) {
		throw new Response("Not Found", { status: 404 });
	}
	return { ok: true as const };
}

export const getQuestionImprovementDrafts = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getQuestionImprovementDraftsSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		return getQuestionImprovementDraftsHandler(data, request.headers);
	});

export const approveQuestionImprovementDraft = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		mutateQuestionImprovementDraftSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		return approveQuestionImprovementDraftHandler(data, request.headers);
	});

export const discardQuestionImprovementDraft = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		mutateQuestionImprovementDraftSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		return discardQuestionImprovementDraftHandler(data, request.headers);
	});
