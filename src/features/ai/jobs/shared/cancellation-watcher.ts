const DEFAULT_POLL_INTERVAL_MS = 2_000;

export async function withCancellationWatch<T>(input: {
	isCancelled: () => Promise<boolean>;
	abortSignal?: AbortSignal;
	execute: (abortSignal: AbortSignal) => Promise<T>;
	pollIntervalMs?: number;
}): Promise<T> {
	if (!input.abortSignal) {
		const controller = new AbortController();
		let stopped = false;

		const check = async () => {
			if (stopped) return;
			try {
				if (await input.isCancelled()) {
					if (!stopped) controller.abort();
				}
			} catch {
				// Ignore polling errors — the agent itself will surface real failures
			}
		};

		const intervalId = setInterval(
			() => void check(),
			input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
		);

		try {
			return await input.execute(controller.signal);
		} finally {
			stopped = true;
			clearInterval(intervalId);
		}
	}

	return input.execute(input.abortSignal);
}
