import { afterEach, describe, expect, it, vi } from "vitest";
import { createRafProcessBatcher } from "@/features/ai/pipeline/client/run-job-with-retries";

vi.mock("@/features/background-processes/store/store", () => ({
	updateProcess: vi.fn(),
}));

import { updateProcess } from "@/features/background-processes/store/store";

interface TestProcess {
	id: string;
	count: number;
}

describe("createRafProcessBatcher", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("queues patches and applies them on the next animation frame", async () => {
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
			rafCallbacks.push(cb);
			return 1;
		});

		const batcher = createRafProcessBatcher<TestProcess, Partial<TestProcess>>(
			"proc-1",
			{
				isProcess: (process): process is TestProcess =>
					typeof process === "object" &&
					process != null &&
					"id" in process,
				patchProcess: (process, patch) => ({ ...process, ...patch }),
			},
		);

		batcher.queue({ count: 1 });
		batcher.queue({ count: 2 });

		expect(updateProcess).not.toHaveBeenCalled();
		rafCallbacks[0]?.(0);

		expect(updateProcess).toHaveBeenCalledTimes(1);
		expect(updateProcess).toHaveBeenCalledWith("proc-1", expect.any(Function));
	});

	it("flush applies pending patches immediately", () => {
		const batcher = createRafProcessBatcher<TestProcess, Partial<TestProcess>>(
			"proc-1",
			{
				isProcess: (process): process is TestProcess =>
					typeof process === "object" &&
					process != null &&
					"id" in process,
				patchProcess: (process, patch) => ({ ...process, ...patch }),
			},
		);

		batcher.queue({ count: 1 });
		batcher.flush({ count: 3 });

		expect(updateProcess).toHaveBeenCalledTimes(1);
	});
});
