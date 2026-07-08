import { z } from "zod";

export const parserConfidenceSchema = z.enum(["high", "medium", "low"]);

export const parserDocumentTypeSchema = z.enum([
	"notes",
	"syllabus",
	"handout",
	"exercise-list",
	"exam-reference",
	"mixed",
]);

export const sourceSpanSchema = z
	.object({
		sectionLabel: z.string().trim().min(1).nullable(),
		excerpt: z.string().trim().min(1),
	})
	.strict();

export const parsedSectionSchema = z
	.object({
		id: z.string().trim().min(1),
		title: z.string().trim().min(1),
		level: z.number().int().positive(),
		summary: z.string().trim().min(1),
		topicRefs: z.array(z.string().trim().min(1)),
		keyPoints: z.array(z.string().trim().min(1)),
		sourceSpan: sourceSpanSchema,
		confidence: parserConfidenceSchema,
	})
	.strict();

export const parsedTopicSchema = z
	.object({
		id: z.string().trim().min(1),
		name: z.string().trim().min(1),
		summary: z.string().trim().min(1),
		keywords: z.array(z.string().trim().min(1)),
		sectionRefs: z.array(z.string().trim().min(1)),
		sourceSpans: z.array(sourceSpanSchema),
		confidence: parserConfidenceSchema,
	})
	.strict();

export const parsedFactSchema = z
	.object({
		statement: z.string().trim().min(1),
		importance: z.enum(["high", "medium", "low"]),
		topicRefs: z.array(z.string().trim().min(1)),
		sourceSpan: sourceSpanSchema,
		confidence: parserConfidenceSchema,
	})
	.strict();

export const parsedStudyObjectiveSchema = z
	.object({
		description: z.string().trim().min(1),
		topicRefs: z.array(z.string().trim().min(1)),
		sourceSpan: sourceSpanSchema,
		confidence: parserConfidenceSchema,
	})
	.strict();

export const parsedGlossaryEntrySchema = z
	.object({
		term: z.string().trim().min(1),
		definition: z.string().trim().min(1),
		topicRefs: z.array(z.string().trim().min(1)),
		sourceSpan: sourceSpanSchema,
		confidence: parserConfidenceSchema,
	})
	.strict();

export const parsedContextDocumentSchema = z
	.object({
		schemaVersion: z.literal("1"),
		sourceFileId: z.string().trim().min(1),
		title: z.string().trim().min(1),
		documentType: parserDocumentTypeSchema,
		summary: z.string().trim().min(1),
		rawText: z.string().trim().min(1),
		sections: z.array(parsedSectionSchema),
		topics: z.array(parsedTopicSchema),
		facts: z.array(parsedFactSchema),
		studyObjectives: z.array(parsedStudyObjectiveSchema),
		glossary: z.array(parsedGlossaryEntrySchema),
		warnings: z.array(z.string().trim().min(1)),
	})
	.strict()
	.superRefine((document, ctx) => {
		const sectionIds = new Set(document.sections.map((section) => section.id));
		const topicIds = new Set(document.topics.map((topic) => topic.id));

		function validateTopicRefs(
			refs: string[],
			pathPrefix: (string | number)[],
		): void {
			for (let index = 0; index < refs.length; index++) {
				const ref = refs[index];
				if (!topicIds.has(ref)) {
					ctx.addIssue({
						code: "custom",
						message: "topicRef not found in document topics",
						path: [...pathPrefix, index],
					});
				}
			}
		}

		for (let index = 0; index < document.sections.length; index++) {
			validateTopicRefs(document.sections[index].topicRefs, [
				"sections",
				index,
				"topicRefs",
			]);
		}

		for (let index = 0; index < document.topics.length; index++) {
			const topic = document.topics[index];
			for (
				let sectionRefIndex = 0;
				sectionRefIndex < topic.sectionRefs.length;
				sectionRefIndex++
			) {
				const ref = topic.sectionRefs[sectionRefIndex];
				if (!sectionIds.has(ref)) {
					ctx.addIssue({
						code: "custom",
						message: "sectionRef not found in document sections",
						path: ["topics", index, "sectionRefs", sectionRefIndex],
					});
				}
			}
		}

		for (let index = 0; index < document.facts.length; index++) {
			validateTopicRefs(document.facts[index].topicRefs, [
				"facts",
				index,
				"topicRefs",
			]);
		}

		for (let index = 0; index < document.studyObjectives.length; index++) {
			validateTopicRefs(document.studyObjectives[index].topicRefs, [
				"studyObjectives",
				index,
				"topicRefs",
			]);
		}

		for (let index = 0; index < document.glossary.length; index++) {
			validateTopicRefs(document.glossary[index].topicRefs, [
				"glossary",
				index,
				"topicRefs",
			]);
		}
	});

export type ParserConfidence = z.infer<typeof parserConfidenceSchema>;
export type ParserDocumentType = z.infer<typeof parserDocumentTypeSchema>;
export type SourceSpan = z.infer<typeof sourceSpanSchema>;
export type ParsedSection = z.infer<typeof parsedSectionSchema>;
export type ParsedTopic = z.infer<typeof parsedTopicSchema>;
export type ParsedFact = z.infer<typeof parsedFactSchema>;
export type ParsedStudyObjective = z.infer<typeof parsedStudyObjectiveSchema>;
export type ParsedGlossaryEntry = z.infer<typeof parsedGlossaryEntrySchema>;
export type ParsedContextDocument = z.infer<typeof parsedContextDocumentSchema>;

export function parseParsedContextDocument(
	value: unknown,
): { ok: true; data: ParsedContextDocument } | { ok: false } {
	const result = parsedContextDocumentSchema.safeParse(value);
	if (!result.success) {
		return { ok: false };
	}
	return { ok: true, data: result.data };
}
