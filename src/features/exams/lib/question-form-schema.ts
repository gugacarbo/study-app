import { z } from "zod";

export const questionOptionSchema = z.object({
	key: z.string().trim().length(1).regex(/^[A-Z]$/),
	text: z.string().trim().min(1, "O texto da alternativa é obrigatório.").max(1000),
});

export const questionFormSchema = z
	.object({
		question: z
			.string()
			.trim()
			.min(1, "O enunciado é obrigatório.")
			.max(5000),
		topic: z.string().trim().max(200).optional().nullable(),
		scoringMode: z.enum(["exact", "partial"]),
		options: z
			.array(questionOptionSchema)
			.min(2, "São necessárias pelo menos 2 alternativas.")
			.max(10, "São permitidas no máximo 10 alternativas."),
		answers: z
			.array(z.string().trim().min(1))
			.min(1, "Marque pelo menos uma alternativa correta."),
		explanation: z.string().trim().max(10000).optional().nullable(),
		deepExplanation: z.string().trim().max(10000).optional().nullable(),
	})
	.superRefine((data, ctx) => {
		const optionKeys = new Set(data.options.map((option) => option.key));

		for (let i = 0; i < data.answers.length; i++) {
			const answer = data.answers[i];
			if (!answer || !optionKeys.has(answer)) {
				ctx.addIssue({
					code: "custom",
					message: "Resposta correta não encontrada nas alternativas.",
					path: ["answers", i],
				});
			}
		}

		if (data.scoringMode === "exact" && data.answers.length !== 1) {
			ctx.addIssue({
				code: "custom",
				message: "No modo resposta única, marque exatamente uma alternativa.",
				path: ["answers"],
			});
		}
	});

export type QuestionFormInput = z.infer<typeof questionFormSchema>;
