import { describe, expect, it, vi } from "vitest";
import { uploadIngestJobFileWithProgress } from "@/features/exams/lib/ingest-api";

type MockXhr = {
	upload: { addEventListener: ReturnType<typeof vi.fn> };
	addEventListener: ReturnType<typeof vi.fn>;
	open: ReturnType<typeof vi.fn>;
	send: ReturnType<typeof vi.fn>;
	status: number;
	responseText: string;
};

function createMockXhr(): MockXhr {
	const listeners = new Map<string, Array<(event?: unknown) => void>>();
	const uploadListeners = new Map<string, Array<(event?: unknown) => void>>();

	return {
		upload: {
			addEventListener: vi.fn((type: string, handler: (event?: unknown) => void) => {
				const list = uploadListeners.get(type) ?? [];
				list.push(handler);
				uploadListeners.set(type, list);
			}),
		},
		addEventListener: vi.fn((type: string, handler: (event?: unknown) => void) => {
			const list = listeners.get(type) ?? [];
			list.push(handler);
			listeners.set(type, list);
		}),
		open: vi.fn(),
		send: vi.fn(function send(this: MockXhr) {
			for (const handler of uploadListeners.get("progress") ?? []) {
				handler({ lengthComputable: true, loaded: 50, total: 100 });
			}
			this.status = 200;
			this.responseText = "{}";
			for (const handler of listeners.get("load") ?? []) {
				handler();
			}
		}),
		status: 200,
		responseText: "{}",
	};
}

describe("uploadIngestJobFileWithProgress", () => {
	it("reports progress and resolves on successful upload", async () => {
		const xhr = createMockXhr();
		const XHR = vi.fn(function XHRConstructor() {
			return xhr;
		});
		vi.stubGlobal("XMLHttpRequest", XHR);

		const onProgress = vi.fn();
		const file = new File(["conteúdo"], "prova.md", { type: "text/markdown" });

		await uploadIngestJobFileWithProgress("job-1", file, onProgress);

		expect(XHR).toHaveBeenCalledOnce();
		expect(xhr.open).toHaveBeenCalledWith(
			"POST",
			"/api/jobs/job-1/upload",
		);
		expect(onProgress).toHaveBeenCalledWith(50);
		expect(onProgress).toHaveBeenCalledWith(100);

		vi.unstubAllGlobals();
	});

	it("rejects with parsed error body on HTTP failure", async () => {
		const xhr = createMockXhr();
		xhr.send = vi.fn(function send(this: MockXhr) {
			this.status = 413;
			this.responseText = JSON.stringify({
				error: "file_too_large",
				maxBytes: 1_048_576,
			});
			const listeners = new Map<string, Array<(event?: unknown) => void>>();
			for (const call of xhr.addEventListener.mock.calls) {
				const [type, handler] = call as [string, (event?: unknown) => void];
				const list = listeners.get(type) ?? [];
				list.push(handler);
				listeners.set(type, list);
			}
			for (const handler of listeners.get("load") ?? []) {
				handler();
			}
		});

		vi.stubGlobal(
			"XMLHttpRequest",
			vi.fn(function XHRConstructor() {
				return xhr;
			}),
		);

		const file = new File(["conteúdo"], "prova.md", { type: "text/markdown" });

		await expect(
			uploadIngestJobFileWithProgress("job-1", file, vi.fn()),
		).rejects.toThrow(/1024 KB/i);

		vi.unstubAllGlobals();
	});
});
