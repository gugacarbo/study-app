import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import { GENERATE_EXAM_DIFFICULTY } from "@/lib/job-kinds";
import { readGenerateExamContextWithDeps } from "./read-context";

const testDb = createTestDb();
const userId = "00000000-0000-4000-8000-000000000401";

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: vi.fn(() => testDb),
	};
});

function resetDb() {
	const sqlite = (
		testDb as unknown as {
			session: { client: { exec: (sql: string) => void } };
		}
	).session.client;
	for (const table of ["files", "exams", "background_jobs", "user"]) {
		sqlite.exec(`DELETE FROM ${table}`);
	}
}

async function seedExam(examName = "Prova gerada") {
	await testDb
		.insert(schema.user)
		.values({
			id: userId,
			name: "User",
			email: `${userId}@aluno.ifsc.edu.br`,
			emailVerified: true,
		})
		.onConflictDoNothing({ target: schema.user.id });
	const examId = createId();
	await testDb.insert(schema.exams).values({
		id: examId,
		userId,
		name: examName,
	});
	return examId;
}

async function seedFile(
	examId: string,
	name: string,
	r2Key: string,
	text: string,
) {
	const fileId = createId();
	await testDb.insert(schema.files).values({
		id: fileId,
		examId,
		name,
		r2Key,
		mimeType: "text/plain; charset=utf-8",
		size: new TextEncoder().encode(text).byteLength,
		ttlSeconds: 0,
	});
	return { fileId, r2Key, text };
}

function makeR2Bucket(contents: Map<string, string>) {
	return {
		get: vi.fn(async (key: string) => {
			const text = contents.get(key);
			if (!text) return null;
			return {
				size: new TextEncoder().encode(text).byteLength,
				arrayBuffer: async () => new TextEncoder().encode(text).buffer,
			};
		}),
	};
}

describe("readGenerateExamContextWithDeps", () => {
	beforeEach(() => {
		resetDb();
		vi.clearAllMocks();
	});

	it("reads mainContent and context files in creation order", async () => {
		const examId = await seedExam();
		const mainText = "Conteúdo base da prova.";
		const contextText1 = "Contexto adicional 1.";
		const contextText2 = "Contexto adicional 2.";

		const main = await seedFile(
			examId,
			"conteudo-base.md",
			"main-key",
			mainText,
		);
		const ctx1 = await seedFile(
			examId,
			"contexto-1.md",
			"ctx-1-key",
			contextText1,
		);
		const ctx2 = await seedFile(
			examId,
			"contexto-2.md",
			"ctx-2-key",
			contextText2,
		);

		const contents = new Map<string, string>([
			[main.r2Key, mainText],
			[ctx1.r2Key, contextText1],
			[ctx2.r2Key, contextText2],
		]);
		const bucket = makeR2Bucket(contents);

		const metadata = {
			examId,
			modelId: "model-1",
			questionCount: 3,
			difficulty: GENERATE_EXAM_DIFFICULTY.MEDIUM,
			fileIds: [ctx1.fileId, ctx2.fileId],
		};

		const result = await readGenerateExamContextWithDeps(
			testDb,
			metadata,
			userId,
			{
				getR2Object: bucket.get,
			},
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.context.mainContentFileId).toBe(main.fileId);
		expect(result.context.mainContent).toBe(mainText);
		expect(result.context.contextFiles).toHaveLength(2);
		expect(result.context.contextFiles[0]?.fileId).toBe(ctx1.fileId);
		expect(result.context.contextFiles[1]?.fileId).toBe(ctx2.fileId);
	});

	it("returns terminal error when mainContent is missing", async () => {
		const examId = await seedExam();
		const contextText = "Contexto adicional.";
		const ctx = await seedFile(examId, "contexto.md", "ctx-key", contextText);
		const contents = new Map<string, string>([[ctx.r2Key, contextText]]);
		const bucket = makeR2Bucket(contents);

		const metadata = {
			examId,
			modelId: "model-1",
			questionCount: 3,
			difficulty: GENERATE_EXAM_DIFFICULTY.MEDIUM,
			fileIds: [ctx.fileId],
		};

		const result = await readGenerateExamContextWithDeps(
			testDb,
			metadata,
			userId,
			{ getR2Object: bucket.get },
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.terminal.error).toBe(JOB_ERROR_CODE.EMPTY_FILE);
	});

	it("returns terminal error when a context file is missing in R2", async () => {
		const examId = await seedExam();
		const mainText = "Conteúdo base.";
		const main = await seedFile(
			examId,
			"conteudo-base.md",
			"main-key",
			mainText,
		);
		const ctx = await seedFile(examId, "contexto.md", "ctx-key", "Contexto.");

		const contents = new Map<string, string>([[main.r2Key, mainText]]);
		const bucket = makeR2Bucket(contents);

		const metadata = {
			examId,
			modelId: "model-1",
			questionCount: 3,
			difficulty: GENERATE_EXAM_DIFFICULTY.MEDIUM,
			fileIds: [ctx.fileId],
		};

		const result = await readGenerateExamContextWithDeps(
			testDb,
			metadata,
			userId,
			{ getR2Object: bucket.get },
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.terminal.error).toBe(JOB_ERROR_CODE.EXAM_NOT_FOUND);
	});
});
