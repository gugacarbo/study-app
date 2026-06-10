import type { D1Database } from "@cloudflare/workers-types";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { Question } from "../../lib/validation";
import * as schema from "../schema";
import type {
	AnswerKeyListItem,
	AttemptListItem,
	AttemptStatsSummary,
	ExamDetail,
	ExamFull,
	ExamRecord,
	FileInfo,
	FileRecord,
	ListAnswerKeysFilters,
	ListAttemptsFilters,
	ListExamsFilters,
	ListQuestionsFilters,
	LLMLogInsert,
	PaginatedResult,
	QuestionListItem,
	TopicStats,
} from "./types";

export type DrizzleDB = DrizzleD1Database<typeof schema>;

export interface DBQueries {
	insertFile(
		examId: number,
		name: string,
		r2Key: string,
		size: number,
		mimeType?: string,
	): Promise<number>;
	getFile(id: number): Promise<FileRecord | null>;
	getFilesByExam(examId: number): Promise<FileInfo[]>;
	deleteFile(id: number): Promise<void>;
	insertExam(name: string, source?: string): Promise<number>;
	getExamById(id: number): Promise<ExamRecord | null>;
	getExams(): Promise<ExamRecord[]>;
	listExamsPaged(
		filters?: ListExamsFilters,
	): Promise<PaginatedResult<ExamRecord>>;
	getExamsDetailed(): Promise<ExamDetail[]>;
	getExamStats(examId: number): Promise<{
		totalQuestions: number;
		totalAttempts: number;
		completedAttempts: number;
		incompleteAttempts: number;
		correctAnswers: number;
		answeredQuestions: number;
		overallAccuracy: number;
		topicStats: TopicStats[];
	}>;
	getExamFull(examId: number): Promise<ExamFull | null>;
	deleteExam(id: number): Promise<void>;
	insertQuestions(examId: number, questions: Question[]): Promise<void>;
	updateQuestion(
		id: number,
		data: {
			question?: string;
			options?: string[];
			answers?: string[];
			scoringMode?: "exact" | "partial";
			explanation?: string;
			deepExplanation?: string;
			topic?: string;
		},
	): Promise<void>;
	deleteQuestion(id: number): Promise<void>;
	listQuestionsPaged(
		filters?: ListQuestionsFilters,
	): Promise<PaginatedResult<QuestionListItem>>;
	listAnswerKeysPaged(
		filters?: ListAnswerKeysFilters,
	): Promise<PaginatedResult<AnswerKeyListItem>>;
	getQuestionsByExam(examId: number): Promise<ParsedQuestion[]>;
	getQuestionById(questionId: number): Promise<ParsedQuestion | null>;
	getRandomQuestions(limit: number, topic?: string): Promise<ParsedQuestion[]>;
	createAttemptSession(input: {
		examId?: number;
		topic?: string;
		totalQuestions: number;
	}): Promise<number>;
	abandonInProgressAttempts(input: {
		examId?: number;
		topic?: string;
	}): Promise<void>;
	upsertAttemptAnswer(input: {
		attemptId: number;
		questionId: number;
		userAnswers: string[];
		correct: boolean;
		credit: number;
	}): Promise<void>;
	refreshAttemptProgress(attemptId: number): Promise<void>;
	getAttemptById(attemptId: number): Promise<AttemptListItem | null>;
	listAttemptsPaged(
		filters?: ListAttemptsFilters,
	): Promise<PaginatedResult<AttemptListItem>>;
	getStats(): Promise<AttemptStatsSummary & { topics: TopicStats[] }>;
	getConfig(key: string): Promise<string | null>;
	setConfig(key: string, value: string): Promise<void>;
	getAllConfig(): Promise<Record<string, string>>;
	insertLLMLog(log: LLMLogInsert): Promise<void>;
}

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: methods added via Object.assign in index.ts
export class DBQueries {
	db: DrizzleDB;
	d1: D1Database;

	constructor(d1: D1Database) {
		this.d1 = d1;
		this.db = drizzle(d1, { schema });
	}
}

interface ParsedQuestion {
	id: number;
	exam_id: number | null;
	question: string;
	options: string[];
	answers: string[];
	scoringMode: "exact" | "partial";
	explanation: string;
	deepExplanation: string;
	topic: string;
}
