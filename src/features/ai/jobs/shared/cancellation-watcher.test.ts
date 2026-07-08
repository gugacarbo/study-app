import { describe, expect, it, vi } from "vitest";
import { withCancellationWatch } from "@/features/ai/jobs/shared/cancellation-watcher";

describe("withCancellationWatch", () => {
	it("returns the result when not cancelled", async () => {
		const result = await withCancellationWatch({
			isCancelled: async () => false,
			execute: async () => "ok",
		});
		expect(result).toBe("ok");
	});

	it("aborts the signal when isCancelled returns true", async () => {
		let cancelled = false;
		const isCancelled = vi.fn(async () => cancelled);

		const result = withCancellationWatch({
			isCancelled,
			pollIntervalMs: 10,
			execute: async (signal: AbortSignal) => {
				while (!signal.aborted) {
					await new Promise((r) => setTimeout(r, 5));
				}
				throw new Error("aborted");
			},
		});

		setTimeout(() => {
			cancelled = true;
		}, 20);

		await expect(result).rejects.toThrow("aborted");
		expect(isCancelled).toHaveBeenCalled();
	});

	it("stops polling after execute resolves", async () => {
		let pollCount = 0;
		const isCancelled = vi.fn(async () => {
			pollCount += 1;
			return false;
		});

		await withCancellationWatch({
			isCancelled,
			pollIntervalMs: 10,
			execute: async () => "done",
		});

		const pollsAfterExecute = pollCount;
		await new Promise((r) => setTimeout(r, 30));
		expect(pollCount).toBe(pollsAfterExecute);
	});

	it("passes through an external abortSignal when provided", async () => {
		const controller = new AbortController();
		const resultPromise = withCancellationWatch({
			isCancelled: async () => false,
			abortSignal: controller.signal,
			execute: async (signal) => {
				while (!signal.aborted) {
					await new Promise((r) => setTimeout(r, 5));
				}
				return true;
			},
		});
		setTimeout(() => controller.abort(), 20);
		expect(await resultPromise).toBe(true);
	});
});