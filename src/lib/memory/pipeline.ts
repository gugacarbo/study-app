import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { buildQuestionBankContent } from "./content";
import { buildStatsContent, buildWebResearchContent } from "./content-extra";
import { ensureTables, upsertDocument } from "./d1-operations";
import { sessionSlug, writeToR2 } from "./r2-operations";

export async function exportQuestionsToVault(
	db: D1Database,
	bucket: R2Bucket,
	examName: string,
	topic: string,
	questions: Array<{
		question: string;
		options: string[];
		answer: string;
		explanation?: string;
	}>,
): Promise<string> {
	await ensureTables(db);
	const content = buildQuestionBankContent(examName, topic, questions);
	const slug = examName
		.replace(/[^a-z0-9]+/gi, "-")
		.toLowerCase()
		.replace(/(^-|-$)/g, "");
	const filePath = `questions/${slug}.md`;

	await writeToR2(bucket, filePath, content);
	await upsertDocument(db, "question-bank", filePath, topic, filePath, content);
	return filePath;
}

export async function saveWebResearch(
	db: D1Database,
	bucket: R2Bucket,
	data: {
		query: string;
		summary: string;
		sources: string[];
		conclusion?: string;
		topic?: string | null;
		context?: "chat" | "ingest" | "reviewer";
	},
): Promise<string> {
	await ensureTables(db);
	const now = new Date();
	const timestamp = now.toISOString();
	const safeSlug = sessionSlug(data.query).slice(0, 80) || "search";
	const unique = timestamp.replace(/[:.]/g, "-");
	const r2Key = `memory/research/${now.toISOString().slice(0, 10)}-${safeSlug}-${unique}.md`;
	const name = `research/${safeSlug}-${unique}.md`;
	const uniqueSources = Array.from(
		new Set(data.sources.map((s) => s.trim()).filter(Boolean)),
	);

	const content = buildWebResearchContent({ ...data, timestamp });
	await writeToR2(bucket, r2Key, content);
	await upsertDocument(
		db,
		"web-research",
		name,
		data.topic ?? null,
		r2Key,
		`${data.query}\n${data.summary}\n${data.conclusion ?? ""}\n${uniqueSources.join("\n")}`,
	);
	return r2Key;
}

export async function saveStatsToVault(
	db: D1Database,
	bucket: R2Bucket,
	stats: {
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
	},
): Promise<string> {
	await ensureTables(db);
	const date = new Date().toISOString().slice(0, 10);
	const filePath = "stats/progresso-geral.md";

	const content = buildStatsContent(stats, date);
	await writeToR2(bucket, filePath, content);
	await upsertDocument(db, "stats-snapshot", filePath, null, filePath, content);
	return filePath;
}

interface MemoryContextParts {
	profileNotes: string;
	recentSessions: string;
	topicNotes: string;
	relevantSearchResults: string;
}

export function buildMemoryPrompt(ctx: MemoryContextParts): string {
	const parts: string[] = [];
	if (ctx.profileNotes) {
		parts.push(
			`<user_profile>\n${ctx.profileNotes.slice(0, 1000)}\n</user_profile>`,
		);
	}
	if (ctx.recentSessions) {
		parts.push(
			`<recent_sessions>\n${ctx.recentSessions.slice(0, 2000)}\n</recent_sessions>`,
		);
	}
	if (ctx.topicNotes) {
		parts.push(
			`<topic_notes>\n${ctx.topicNotes.slice(0, 2000)}\n</topic_notes>`,
		);
	}
	if (ctx.relevantSearchResults) {
		parts.push(
			`<vault_search>\n${ctx.relevantSearchResults.slice(0, 2000)}\n</vault_search>`,
		);
	}
	return parts.join("\n\n");
}
