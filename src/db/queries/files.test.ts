import { describe, expect, it } from "vitest";
import { createExam } from "@/db/queries/exams";
import { listExpiredFiles } from "@/db/queries/files";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

describe("files queries", () => {
	it("listExpiredFiles ignores ttl_seconds = 0", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();

		await db.insert(schema.user).values({
			id: userId,
			name: "U",
			email: "u@aluno.ifsc.edu.br",
			emailVerified: true,
		});
		await createExam(db, { id: examId, userId, name: "Exam" });

		await db.insert(schema.files).values({
			id: createId(),
			examId,
			name: "keep.txt",
			r2Key: `users/${userId}/files/keep.txt`,
			ttlSeconds: 0,
			createdAt: "2000-01-01 00:00:00",
		});

		const expired = await listExpiredFiles(db, 10);
		expect(expired).toHaveLength(0);
	});

	it("listExpiredFiles returns rows past ttl", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();

		await db.insert(schema.user).values({
			id: userId,
			name: "U",
			email: "u@aluno.ifsc.edu.br",
			emailVerified: true,
		});
		await createExam(db, { id: examId, userId, name: "Exam" });

		const fileId = createId();
		await db.insert(schema.files).values({
			id: fileId,
			examId,
			name: "old.txt",
			r2Key: `users/${userId}/files/old.txt`,
			ttlSeconds: 60,
			createdAt: "2000-01-01 00:00:00",
		});

		const expired = await listExpiredFiles(db, 10);
		expect(expired.map((row) => row.id)).toContain(fileId);
	});
});
