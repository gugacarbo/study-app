import { describe, expect, it, vi } from "vitest";
import { readFileHandler } from "@/functions/storage/read-file";

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
	auditedR2Get: vi.fn(),
}));

describe("read-file", () => {
	it("returns 404 when file is not owned by user", async () => {
		const filesModule = await import("@/db/queries/files");
		vi.spyOn(filesModule, "getFileByIdWithOwnership").mockResolvedValue(null);

		await expect(
			readFileHandler(
				{ fileId: "00000000-0000-4000-8000-000000000001" },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 404 });
	});

	it("returns 404 when R2 object is missing", async () => {
		const filesModule = await import("@/db/queries/files");
		const r2Audit = await import("@/lib/r2-audit");
		const storage = await import("@/functions/storage");

		vi.spyOn(filesModule, "getFileByIdWithOwnership").mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000001",
			examId: "00000000-0000-4000-8000-000000000002",
			name: "notes.md",
			r2Key: "users/user-1/files/notes.md",
			mimeType: "text/markdown",
			size: 5,
			ttlSeconds: 0,
			createdAt: "2026-01-01 00:00:00",
		});
		vi.mocked(storage.requireFilesBucket).mockResolvedValue({} as never);
		vi.mocked(r2Audit.auditedR2Get).mockResolvedValue(null);

		await expect(
			readFileHandler(
				{ fileId: "00000000-0000-4000-8000-000000000001" },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 404 });
	});

	it("returns file metadata and base64 content", async () => {
		const filesModule = await import("@/db/queries/files");
		const r2Audit = await import("@/lib/r2-audit");
		const storage = await import("@/functions/storage");

		vi.spyOn(filesModule, "getFileByIdWithOwnership").mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000001",
			examId: "00000000-0000-4000-8000-000000000002",
			name: "notes.md",
			r2Key: "users/user-1/files/notes.md",
			mimeType: "text/markdown",
			size: 5,
			ttlSeconds: 0,
			createdAt: "2026-01-01 00:00:00",
		});
		vi.mocked(storage.requireFilesBucket).mockResolvedValue({} as never);
		vi.mocked(r2Audit.auditedR2Get).mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
		} as never);

		const result = await readFileHandler(
			{ fileId: "00000000-0000-4000-8000-000000000001" },
			new Headers(),
		);

		expect(result).toMatchObject({
			id: "00000000-0000-4000-8000-000000000001",
			filename: "notes.md",
			mimeType: "text/markdown",
			contentBase64: btoa("hello"),
		});
	});
});
