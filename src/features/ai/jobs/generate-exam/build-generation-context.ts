import type {
	GenerateExamDifficulty,
	GenerateExamJobMetadata,
} from "@/lib/job-kinds";
import type { ParsedContextDocument } from "./parser-schema";
import type {
	GenerateExamGenerationContext,
	GenerateExamRawContext,
} from "./types";

export type BuildGenerationContextResult =
	| { ok: true; context: GenerateExamGenerationContext }
	| { ok: false; error: string };

export function buildGenerationContext(
	rawContext: GenerateExamRawContext,
	parsedDocuments: ParsedContextDocument[],
	metadata: GenerateExamJobMetadata,
): BuildGenerationContextResult {
	const questionCount = metadata.questionCount;
	const difficulty: GenerateExamDifficulty = metadata.difficulty;

	if (
		!Number.isInteger(questionCount) ||
		questionCount < 1 ||
		questionCount > 20
	) {
		return {
			ok: false,
			error: `questionCount inválido: ${questionCount}`,
		};
	}

	const validDifficulties: GenerateExamDifficulty[] = [
		"easy",
		"medium",
		"hard",
	];
	if (!validDifficulties.includes(difficulty)) {
		return {
			ok: false,
			error: `difficulty inválido: ${difficulty}`,
		};
	}

	return {
		ok: true,
		context: {
			mainContent: rawContext.mainContent,
			parsedContextDocuments: parsedDocuments,
			questionCount,
			difficulty,
			difficultyNotes: metadata.difficultyNotes,
		},
	};
}
