import {
	type JobUIMessageStreamWriter,
	writeJobProgress,
} from "@/features/ai/core/ui-message-job-stream";

export interface JobProgressTrackerOptions {
	stageId?: string;
	agentRunId?: string;
	signal?: AbortSignal;
	canceledMessage?: string;
}

export class JobProgressTracker {
	private lastProgress = 0;

	constructor(
		private writer: JobUIMessageStreamWriter,
		private options: JobProgressTrackerOptions = {},
	) {}

	assertNotAborted(): void {
		if (this.options.signal?.aborted) {
			throw new Error(this.options.canceledMessage ?? "Job canceled");
		}
	}

	step(percent: number, label: string): void {
		this.assertNotAborted();
		const bounded = Math.max(this.lastProgress, Math.min(100, percent));
		this.lastProgress = bounded;
		writeJobProgress(this.writer, {
			step: label,
			percent: bounded,
			stageId: this.options.stageId,
			agentRunId: this.options.agentRunId,
		});
	}
}
