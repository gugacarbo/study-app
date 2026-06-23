type QueueItem = {
	payload: string;
	resolve: () => void;
	reject: (error: unknown) => void;
};

export class JobEventAppender {
	private queue: QueueItem[] = [];
	private running = false;
	private readonly maxRetries = 3;
	private readonly baseDelayMs = 10;

	constructor(
		private readonly jobId: string,
		private readonly appendJobEvent: (
			jobId: string,
			payload: string,
		) => Promise<void>,
	) {}

	append(payload: unknown): Promise<void> {
		const serialized =
			typeof payload === "string" ? payload : JSON.stringify(payload);

		return new Promise((resolve, reject) => {
			this.queue.push({ payload: serialized, resolve, reject });
			void this.process();
		});
	}

	private async process(): Promise<void> {
		if (this.running) return;
		this.running = true;

		while (this.queue.length > 0) {
			const item = this.queue.shift();
			if (!item) continue;

			try {
				await this.appendWithRetry(item.payload);
				item.resolve();
			} catch (error) {
				item.reject(error);
			}
		}

		this.running = false;
	}

	private async appendWithRetry(payload: string): Promise<void> {
		for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
			try {
				await this.appendJobEvent(this.jobId, payload);
				return;
			} catch (error) {
				const isUniqueViolation =
					error instanceof Error &&
					(/unique/i.test(error.message) || /constraint/i.test(error.message));

				if (!isUniqueViolation || attempt === this.maxRetries) {
					throw error;
				}

				await new Promise((resolve) =>
					setTimeout(resolve, this.baseDelayMs * 2 ** attempt),
				);
			}
		}
	}
}
