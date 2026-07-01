import { describe, expect, it } from "vitest";
import {
	JOB_LEASE_TTL_MS,
	JOB_PROCESSING_STATE,
	JOB_QUEUE_STALE_AFTER_MS,
	deriveJobProcessing,
} from "./job-processing";

function jobFixture(
	overrides: Partial<{
		status: string;
		updatedAt: string | null;
		heartbeatAt: string | null;
		leaseExpiresAt: string | null;
		recoveryAttempts: number;
		lastRecoveredAt: string | null;
	}> = {},
) {
	return {
		status: "running",
		updatedAt: null,
		heartbeatAt: null,
		leaseExpiresAt: null,
		recoveryAttempts: 0,
		lastRecoveredAt: null,
		...overrides,
	};
}

describe("deriveJobProcessing", () => {
	it("treats D1 'YYYY-MM-DD HH:MM:SS' timestamps as UTC", () => {
		const heartbeatAt = "2026-07-01 00:09:00";
		const leaseExpiresAt = "2026-07-01 01:05:41";
		const now = new Date("2026-07-01T00:10:00.000Z");

		const result = deriveJobProcessing(
			jobFixture({ heartbeatAt, leaseExpiresAt }),
			now,
		);

		expect(result.state).toBe(JOB_PROCESSING_STATE.ACTIVE);
	});

	it("marks a running job stale when the lease expired", () => {
		const now = new Date("2026-07-01T00:10:00.000Z");
		const heartbeatAt = "2026-07-01T00:05:00.000Z";
		const leaseExpiresAt = "2026-07-01T00:06:00.000Z";

		const result = deriveJobProcessing(
			jobFixture({ heartbeatAt, leaseExpiresAt }),
			now,
		);

		expect(result.state).toBe(JOB_PROCESSING_STATE.STALE_RUNNING);
	});

	it("marks a running job stale when the heartbeat is too old", () => {
		const now = new Date("2026-07-01T00:10:00.000Z");
		const heartbeatAt = "2026-07-01T00:08:00.000Z";
		const leaseExpiresAt = "2026-07-02T00:10:00.000Z";

		const result = deriveJobProcessing(
			jobFixture({ heartbeatAt, leaseExpiresAt }),
			now,
		);

		expect(result.state).toBe(JOB_PROCESSING_STATE.STALE_RUNNING);
	});

	it("keeps a running job active with a fresh heartbeat", () => {
		const now = new Date("2026-07-01T00:10:00.000Z");
		const heartbeatAt = now.toISOString();
		const leaseExpiresAt = new Date(
			now.getTime() + JOB_LEASE_TTL_MS,
		).toISOString();

		const result = deriveJobProcessing(
			jobFixture({ heartbeatAt, leaseExpiresAt }),
			now,
		);

		expect(result.state).toBe(JOB_PROCESSING_STATE.ACTIVE);
	});

	it("marks a queued job stale after the queue stale window", () => {
		const now = new Date("2026-07-01T00:10:00.000Z");
		const updatedAt = new Date(
			now.getTime() - JOB_QUEUE_STALE_AFTER_MS - 1,
		).toISOString();

		const result = deriveJobProcessing(
			jobFixture({ status: "queued", updatedAt }),
			now,
		);

		expect(result.state).toBe(JOB_PROCESSING_STATE.STALE_QUEUED);
	});
});
