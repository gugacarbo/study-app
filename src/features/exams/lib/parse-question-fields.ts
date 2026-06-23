import { z } from "zod";
import type { QuestionRow } from "@/db/queries/questions";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

const optionKeySchema = z
	.string()
	.trim()
	.length(1)
	.regex(/^[A-Z]$/);

const optionSchema = z.object({
	key: optionKeySchema,
	text: z.string().trim().min(1),
});

const parsedFieldsSchema = z
	.object({
		options: z.array(optionSchema).min(1),
		answers: z.array(z.string()).min(1),
	})
	.superRefine((data, ctx) => {
		const keys = new Set(data.options.map((option) => option.key));
		for (let i = 0; i < data.answers.length; i++) {
			const answerKey = data.answers[i]?.trim();
			if (!answerKey || !keys.has(answerKey)) {
				ctx.addIssue({
					code: "custom",
					message: "answer key not found in options",
					path: ["answers", i],
				});
			}
		}
	});

const scoringModeSchema = z.enum(["exact", "partial"]);

function parseJsonField(raw: string): unknown {
	return JSON.parse(raw) as unknown;
}

export function parseQuestionRow(row: QuestionRow): QuestionDetail | null {
	let optionsRaw: unknown;
	let answersRaw: unknown;

	try {
		optionsRaw = parseJsonField(row.options);
	} catch {
		return null;
	}

	try {
		answersRaw = parseJsonField(row.answers);
	} catch {
		return null;
	}

	const parsed = parsedFieldsSchema.safeParse({
		options: optionsRaw,
		answers: answersRaw,
	});
	if (!parsed.success) {
		return null;
	}

	const scoringMode = scoringModeSchema.safeParse(row.scoringMode);
	if (!scoringMode.success) {
		return null;
	}

	return {
		id: row.id,
		question: row.question,
		options: parsed.data.options,
		answers: parsed.data.answers.map((answer) => answer.trim()),
		topic: row.topic,
		scoringMode: scoringMode.data,
		explanation: row.explanation,
		deepExplanation: row.deepExplanation,
	};
}
