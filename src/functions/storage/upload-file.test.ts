import { describe, expect, it, vi } from "vitest";
import { uploadFileHandler } from "@/functions/storage/upload-file";

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(),
}));

vi.mock("@/functions/storage", () => ({
	requireFilesBucket: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
	requireSession: vi.fn(async () => ({
		user: { id: "user-1" },
		session: { id: "session-1" },
	})),
}));

vi.mock("@/lib/r2-audit", () => ({
	auditedR2Put: vi.fn(async () => undefined),
	auditedR2Delete: vi.fn(async () => undefined),
}));

describe("upload-file", () => {
	it("rejects unsupported extensions", async () => {
		await expect(
			uploadFileHandler(
				{
					examId: "00000000-0000-4000-8000-000000000001",
					filename: "notes.pdf",
					contentBase64: btoa("hello"),
				},
				new Headers(),
			),
		).rejects.toMatchObject({ status: 400 });
	});
});
