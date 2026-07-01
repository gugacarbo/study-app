import { JOB_STATUS } from "@/lib/job-kinds";

export const JOB_HEARTBEAT_INTERVAL_MS = 15_000;
export const JOB_LEASE_TTL_MS = 90_000;
export const JOB_QUEUE_STALE_AFTER_MS = 120_000;
export const JOB_RECOVERY_MAX_ATTEMPTS = 3;
export const JOB_RECOVERY_CRON = "* * * * *";

export const JOB_PROCESSING_STATE = {
	IDLE: "idle",
	QUEUED: "queued",
	ACTIVE: "active",
	STALE_QUEUED: "stale-queued",
	STALE_RUNNING: "stale-running",
	RECOVERING: "recovering",
} as const;

export type JobProcessingState =
	(typeof JOB_PROCESSING_STATE)[keyof typeof JOB_PROCESSING_STATE];

type ProcessableJob = {
	status: string;
	updatedAt: string | null;
	heartbeatAt: string | null;
	leaseExpiresAt: string | null;
	recoveryAttempts: number;
	lastRecoveredAt: string | null;
};

function parseTimestampMs(value: string | null): number | null {
	if (!value) return null;
	const ms = new Date(value).getTime();
	return Number.isFinite(ms) ? ms : null;
}

export function isTerminalJobStatus(status: string): boolean {
	return (
		status === JOB_STATUS.COMPLETED ||
		status === JOB_STATUS.FAILED ||
		status === JOB_STATUS.CANCELLED
	);
}

export function deriveJobProcessing(
	job: ProcessableJob,
	now = new Date(),
): {
	state: JobProcessingState;
	heartbeatAt: string | null;
	leaseExpiresAt: string | null;
	recoveryAttempts: number;
} {
	if (
		job.status === JOB_STATUS.AWAITING_UPLOAD ||
		isTerminalJobStatus(job.status)
	) {
		return {
			state: JOB_PROCESSING_STATE.IDLE,
			heartbeatAt: job.heartbeatAt,
			leaseExpiresAt: job.leaseExpiresAt,
			recoveryAttempts: job.recoveryAttempts,
		};
	}

	if (job.status === JOB_STATUS.RUNNING) {
		const leaseExpiresMs = parseTimestampMs(job.leaseExpiresAt);
		const heartbeatAtMs = parseTimestampMs(job.heartbeatAt);
		const nowMs = now.getTime();

		const leaseValid = leaseExpiresMs != null && leaseExpiresMs > nowMs;
		const heartbeatFresh =
			heartbeatAtMs != null &&
			nowMs - heartbeatAtMs < JOB_LEASE_TTL_MS;

		// Worker is active only when both the lease is valid AND the heartbeat
		// has been refreshed within the expected window. This prevents a stale
		// lease from masking a dead worker that stopped heartbeating.
		const active = leaseValid && heartbeatFresh;

		return {
			state: active
				? JOB_PROCESSING_STATE.ACTIVE
				: JOB_PROCESSING_STATE.STALE_RUNNING,
			heartbeatAt: job.heartbeatAt,
			leaseExpiresAt: job.leaseExpiresAt,
			recoveryAttempts: job.recoveryAttempts,
		};
	}

	if (job.status === JOB_STATUS.QUEUED) {
		const updatedAtMs = parseTimestampMs(job.updatedAt);
		const lastRecoveredAtMs = parseTimestampMs(job.lastRecoveredAt);
		if (
			updatedAtMs != null &&
			now.getTime() - updatedAtMs >= JOB_QUEUE_STALE_AFTER_MS
		) {
			return {
				state: JOB_PROCESSING_STATE.STALE_QUEUED,
				heartbeatAt: job.heartbeatAt,
				leaseExpiresAt: job.leaseExpiresAt,
				recoveryAttempts: job.recoveryAttempts,
			};
		}
		if (
			lastRecoveredAtMs != null &&
			updatedAtMs != null &&
			lastRecoveredAtMs === updatedAtMs
		) {
			return {
				state: JOB_PROCESSING_STATE.RECOVERING,
				heartbeatAt: job.heartbeatAt,
				leaseExpiresAt: job.leaseExpiresAt,
				recoveryAttempts: job.recoveryAttempts,
			};
		}
	}

	return {
		state: JOB_PROCESSING_STATE.QUEUED,
		heartbeatAt: job.heartbeatAt,
		leaseExpiresAt: job.leaseExpiresAt,
		recoveryAttempts: job.recoveryAttempts,
	};
}
