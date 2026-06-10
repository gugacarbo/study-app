import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { buildQuizSessionContent, buildTopicNoteContent } from "./content";
import { buildInitialProfile, updateProfileContent } from "./content-extra";
import {
	ensureTables,
	getProfileRow,
	insertSession,
	setProfileRow,
	upsertTopicNote,
} from "./d1-operations";
import {
	buildMemoryPrompt,
	exportQuestionsToVault as pipelineExport,
	saveWebResearch as pipelineResearch,
	saveStatsToVault as pipelineStats,
} from "./pipeline";
import { getMemoryContextQuery, getMemoryOverviewQuery } from "./queries";
import {
	PROFILE_KEY,
	readFromR2,
	sessionSlug,
	writeToR2,
} from "./r2-operations";
import { searchMemory } from "./search";
import type {
	MemoryContext,
	MemoryOverview,
	QuizSessionData,
	SearchResult,
} from "./types";
import { resolveBucket } from "./types";

export class MemoryManager {
	private ensureTablesPromise: Promise<void> | null = null;
	private bucketResolved: R2Bucket | null = null;

	constructor(
		private db: D1Database,
		private bucket?: R2Bucket,
	) {}

	private async getBucket(): Promise<R2Bucket> {
		if (this.bucketResolved) return this.bucketResolved;
		this.bucketResolved = this.bucket ?? (await resolveBucket());
		return this.bucketResolved;
	}

	private async ensure(): Promise<void> {
		if (!this.ensureTablesPromise)
			this.ensureTablesPromise = ensureTables(this.db);
		await this.ensureTablesPromise;
	}

	private async readProfile(): Promise<string> {
		await this.ensure();
		const row = await getProfileRow(this.db);
		if (!row?.r2Key) return "";
		return readFromR2(await this.getBucket(), row.r2Key);
	}

	private async writeProfile(content: string): Promise<void> {
		await this.ensure();
		await writeToR2(await this.getBucket(), PROFILE_KEY, content);
		await setProfileRow(this.db, content);
	}

	async ensureStructure(): Promise<void> {
		await this.ensure();
	}

	async saveQuizSession(session: QuizSessionData): Promise<string> {
		await this.ensure();
		const bucket = await this.getBucket();
		const now = new Date();
		const date = now.toISOString().slice(0, 10);
		const accuracy =
			session.totalQuestions > 0
				? Math.round((session.correctAnswers / session.totalQuestions) * 100)
				: 0;
		const uniqueSuffix = now.toISOString().replace(/[:.]/g, "-");
		const slug = sessionSlug(session.topic);
		const filePath = `memory/sessions/${date}-quiz-${slug}-${uniqueSuffix}.md`;

		const content = buildQuizSessionContent(session, date, accuracy);
		await writeToR2(bucket, filePath, content);
		await insertSession(this.db, session, filePath, accuracy, date);
		await this.updateProfile(session);
		return filePath;
	}

	async saveTopicNotes(topic: string, content: string): Promise<string> {
		await this.ensure();
		const { note, filePath } = buildTopicNoteContent(topic, content);
		await writeToR2(await this.getBucket(), filePath, note);
		await upsertTopicNote(this.db, sessionSlug(topic), topic, filePath, note);
		return filePath;
	}

	async exportQuestionsToVault(
		examName: string,
		topic: string,
		questions: Array<{
			question: string;
			options: string[];
			answers: string[];
			explanation?: string;
		}>,
	): Promise<string> {
		await this.ensure();
		return pipelineExport(
			this.db,
			await this.getBucket(),
			examName,
			topic,
			questions,
		);
	}

	async search(query: string): Promise<SearchResult[]> {
		await this.ensure();
		return searchMemory(this.db, await this.getBucket(), query);
	}

	async getOverview(): Promise<MemoryOverview> {
		await this.ensure();
		return getMemoryOverviewQuery(this.db, () => this.readProfile());
	}

	async getMemoryContext(topics: string[]): Promise<MemoryContext> {
		await this.ensure();
		return getMemoryContextQuery(this.db, await this.getBucket(), topics, () =>
			this.readProfile(),
		);
	}

	async buildMemoryPrompt(topics: string[]): Promise<string> {
		return buildMemoryPrompt(await this.getMemoryContext(topics));
	}

	async saveWebResearch(data: {
		query: string;
		summary: string;
		sources: string[];
		conclusion?: string;
		topic?: string | null;
		context?: "chat" | "ingest" | "reviewer";
	}): Promise<string> {
		await this.ensure();
		return pipelineResearch(this.db, await this.getBucket(), data);
	}

	async saveStatsToVault(stats: {
		totalAttempts: number;
		correctAnswers: number;
		answeredQuestions: number;
		topics: Array<{
			topic: string;
			attempts: number;
			completedAnswers: number;
			correctAnswers: number;
			accuracy: number;
		}>;
	}): Promise<string> {
		await this.ensure();
		return pipelineStats(this.db, await this.getBucket(), stats);
	}

	private async updateProfile(session: QuizSessionData): Promise<void> {
		await this.ensure();
		let profile = await this.readProfile();
		if (!profile) profile = buildInitialProfile();

		const today = new Date().toISOString().slice(0, 10);
		const accuracy =
			session.totalQuestions > 0
				? Math.round((session.correctAnswers / session.totalQuestions) * 100)
				: 0;

		const updated = updateProfileContent(profile, session, today, accuracy);
		await this.writeProfile(updated);
	}
}
