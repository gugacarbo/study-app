import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import {
	getPendingQuestionImprovementDraftsByExam,
	resolveQuestionImprovementDraft as resolveQuestionImprovementDraftQuery,
} from "@/db/queries/question-improvement-drafts";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

const getQuestionImprovementDraftsSchema = z.object({
	examId: z.string().uuid(),
});

const optionSchema = z.object({
	key: z.string().trim().length(1).regex(/^[A-Z]$/),
	text: z.string().trim().min(1).max(1000),
	explanation: z.string().trim().max(1000).optional().nullable(),
});

const snapshotSchema = z
	.object({
		question: z.string().trim().min(1).max(5000),
		options: z.array(optionSchema).min(2).max(10),
		answers: z.array(z.string().trim().min(1)).min(1),
		topicId: z.string().uuid().optional().nullable(),
		topic: z
			.string()
			.trim()
			.min(1)
			.max(255)
			.nullish()
			.transform((value) => value ?? null),
		scoringMode: z.enum(["exact", "partial"]),
		explanation: z
			.string()
			.trim()
			.max(10000)
			.nullish()
			.transform((value) => value ?? null),
		deepExplanation: z
			.string()
			.trim()
			.max(10000)
			.nullish()
			.transform((value) => value ?? null),
	})
	.superRefine((data, ctx) => {
		const optionKeys = new Set(data.options.map((option) => option.key));

		for (let i = 0; i < data.answers.length; i++) {
			const answer = data.answers[i];
			if (!answer || !optionKeys.has(answer)) {
				ctx.addIssue({
					code: "custom",
					message: "answer key not found in options",
					path: ["answers", i],
				});
			}
		}

		if (data.scoringMode === "exact" && data.answers.length !== 1) {
			ctx.addIssue({
				code: "custom",
				message: "exact scoring requires exactly one answer",
				path: ["answers"],
			});
		}
	});

const resolveQuestionImprovementDraftSchema = z.discriminatedUnion("action", [
	z.object({
		draftId: z.string().uuid(),
		action: z.literal("approve"),
		finalSnapshot: snapshotSchema,
	}),
	z.object({
		draftId: z.string().uuid(),
		action: z.literal("discard"),
	}),
]);

export type ResolveQuestionImprovementDraftInput = z.infer<
	typeof resolveQuestionImprovementDraftSchema
>;

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

export async function resolveQuestionImprovementDraftHandler(
	input: ResolveQuestionImprovementDraftInput,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	const ok = await resolveQuestionImprovementDraftQuery(db, {
		...input,
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

export const resolveQuestionImprovementDraft = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		resolveQuestionImprovementDraftSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		return resolveQuestionImprovementDraftHandler(data, request.headers);
	});
