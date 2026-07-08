import type {
	GenerateExamDifficulty,
	GenerateExamJobMetadata,
	GenerateExamPhase,
	TokenUsage,
} from "@/lib/job-kinds";
import type { ParsedContextDocument } from "./parser-schema";

export type GenerateExamContextFile = {
	fileId: string;
	fileName: string;
	text: string;
};

export type GenerateExamRawContext = {
	mainContentFileId: string;
	mainContent: string;
	contextFiles: GenerateExamContextFile[];
};

export type ParsedContextArtifact = {
	sourceFileId: string;
	artifactFileId: string;
	document: ParsedContextDocument;
};

export type GenerateExamGenerationContext = {
	mainContent: string;
	parsedContextDocuments: ParsedContextDocument[];
	questionCount: number;
	difficulty: GenerateExamDifficulty;
	difficultyNotes?: string;
};

export type GenerateExamJobProgress = {
	phase: GenerateExamPhase;
	metadata: GenerateExamJobMetadata;
};

export type GenerateExamGenerationResult = {
	extractedCount: number;
	persistedCount: number;
	skippedDuplicateCount: number;
	invalidCount: number;
	tokenUsage?: TokenUsage;
	cost?: number;
};
