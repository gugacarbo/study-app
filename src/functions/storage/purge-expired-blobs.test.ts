import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { describe, expect, it, vi } from "vitest";
import { purgeExpiredBlobs } from "@/functions/storage/purge-expired-blobs";

vi.mock("@/lib/r2-audit", () => ({
	auditedR2Delete: vi.fn(async () => undefined),
}));

describe("purge-expired-blobs", () => {
	it("processes expired files batch", async () => {
		const deleteFn = vi.fn(async () => undefined);
		const env = {
			DB: {} as D1Database,
			FILES_BUCKET: { delete: deleteFn } as unknown as R2Bucket,
		};

		const dbModule = await import("@/db/client");
		const filesModule = await import("@/db/queries/files");

		vi.spyOn(dbModule, "createDb").mockReturnValue({} as never);
		vi.spyOn(filesModule, "listExpiredFiles").mockResolvedValue([
			{
				id: "file-1",
				examId: "exam-1",
				name: "old.md",
				r2Key: "users/u/files/old.md",
				mimeType: null,
				size: 1,
				ttlSeconds: 10,
				createdAt: "2000-01-01",
			},
		]);
		vi.spyOn(filesModule, "deleteFile").mockResolvedValue(undefined);

		const result = await purgeExpiredBlobs(env, 100);
		expect(result.processed).toBe(1);
	});
});
