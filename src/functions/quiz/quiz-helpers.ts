import type { AppDatabase } from "@/db/client";
import {
	getAttemptAnswers,
	getQuestionsForAttempt,
	parseConfig,
} from "@/db/queries/attempts";
import type { AttemptRow } from "@/db/queries/attempts";
import { parseQuestionRow } from "@/features/exams/lib/parse-question-fields";
import { calculateCredit } from "./lib/calculate-credit";
import type {
	Attempt,
	AttemptResult,
	AttemptResultQuestion,
	QuestionInAttempt,
	QuizConfig,
} from "./quiz-types";

export { calculateCredit };

export type QuizConfigInternal = QuizConfig & { seed?: number };

function stringToSeed(value: string): number {
	let hash = 1779033703;
	for (let i = 0; i < value.length; i++) {
		const ch = value.charCodeAt(i);
		hash = (hash ^ ch) + ((hash << 5) | (hash >>> 27)) + ch;
	}
	return Math.abs(hash) >>> 0;
}

function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

export function deterministicShuffle<T>(items: T[], seed: number): T[] {
	const rng = mulberry32(seed >>> 0);
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function parseConfigInternal(configJson: string | null): QuizConfigInternal {
	const base = parseConfig(configJson);
	if (!configJson) return base;
	const parsed = JSON.parse(configJson) as Partial<QuizConfigInternal>;
	return { ...base, seed: parsed.seed };
}

export function mapQuestionRowToQuestionInAttempt(
	row: Awaited<ReturnType<typeof getQuestionsForAttempt>>[number],
	selectedOptionIds: string[] = [],
): QuestionInAttempt | null {
	const parsed = parseQuestionRow(row);
	if (!parsed) return null;

	return {
		id: parsed.id,
		question: parsed.question,
		options: parsed.options.map((option) => ({
			id: option.key,
			text: option.text,
		})),
		correctOptionIds: parsed.answers,
		selectedOptionIds,
		scoringMode: parsed.scoringMode,
		topic: parsed.topic,
		explanation: parsed.explanation ?? null,
		deepExplanation: parsed.deepExplanation ?? null,
	};
}

export async function selectAndOrderQuestions(
	db: AppDatabase,
	examId: string,
	config: QuizConfigInternal,
): Promise<QuestionInAttempt[]> {
	const rows = await getQuestionsForAttempt(db, examId, {
		quantity: config.order === "random" ? 0 : config.quantity,
		topicFilter: config.topicFilter,
		order: config.order,
	});

	let ordered = rows;
	if (config.order === "random" && config.seed != null) {
		ordered = deterministicShuffle(rows, config.seed);
	}

	if (config.quantity > 0 && ordered.length > config.quantity) {
		ordered = ordered.slice(0, config.quantity);
	}

	return ordered
		.map((row) => mapQuestionRowToQuestionInAttempt(row))
		.filter((q): q is QuestionInAttempt => q != null);
}

export function calculateFinalScore(
	totalCredit: number,
	totalQuestions: number,
): number {
	if (totalQuestions <= 0) return 0;
	return Math.round((totalCredit / totalQuestions) * 100);
}

export function buildAttempt(config: QuizConfig): {
	config: QuizConfigInternal;
	seed: number;
} {
	const seed = stringToSeed(crypto.randomUUID());
	return { config: { ...config, seed }, seed };
}

export function attemptRowToAttempt(row: AttemptRow): Attempt {
	return {
		id: row.id,
		examId: row.examId,
		config: parseConfigInternal(row.config),
		totalQuestions: row.totalQuestions,
		answeredQuestions: row.answeredQuestions,
		correctAnswers: row.correctAnswers,
		status: row.status as Attempt["status"],
		startedAt: row.startedAt as string,
	};
}

export async function buildAttemptResult(
	db: AppDatabase,
	attemptRow: AttemptRow,
): Promise<AttemptResult> {
	const attempt = attemptRowToAttempt(attemptRow);
	const questions = await selectAndOrderQuestions(
		db,
		attempt.examId,
		attempt.config,
	);
	const answers = await getAttemptAnswers(db, attempt.id);
	const answerMap = new Map(answers.map((a) => [a.questionId, a]));

	let totalCredit = 0;
	const resultQuestions: AttemptResultQuestion[] = [];

	for (const q of questions) {
		const answer = answerMap.get(q.id);
		const selected = answer ? JSON.parse(answer.userAnswer) : [];
		const credit = answer?.credit ?? 0;
		totalCredit += credit;
		resultQuestions.push({
			questionId: q.id,
			question: q.question,
			options: q.options,
			correctOptionIds: q.correctOptionIds,
			selectedOptionIds: selected,
			credit,
			explanation: q.explanation,
		});
	}

	return {
		...attempt,
		scorePercent: calculateFinalScore(totalCredit, attempt.totalQuestions),
		questions: resultQuestions,
	};
}
