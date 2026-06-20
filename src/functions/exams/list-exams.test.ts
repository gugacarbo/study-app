import { beforeEach, describe, expect, it } from "vitest";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import {
	otherUserId,
	resetJobTestDb,
	seedUser,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { listExamsHandler } from "@/functions/exams/list-exams";

describe("listExamsHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("returns only exams owned by the authenticated user", async () => {
		await seedUser(testDb, testUserId);
		await seedUser(testDb, otherUserId);

		const ownedExamId = createId();
		await createExam(testDb, {
			id: ownedExamId,
			userId: testUserId,
			name: "Minha prova",
		});
		await createExam(testDb, {
			id: createId(),
			userId: otherUserId,
			name: "Prova alheia",
		});

		const exams = await listExamsHandler(new Headers());

		expect(exams).toEqual([
			expect.objectContaining({
				id: ownedExamId,
				name: "Minha prova",
				questionCount: 0,
			}),
		]);
	});
});
