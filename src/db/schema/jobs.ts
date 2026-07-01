import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const backgroundJobs = sqliteTable(
	"background_jobs",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		status: text("status").notNull(),
		phase: text("phase"),
		error: text("error"),
		metadata: text("metadata"),
		cancelRequestedAt: text("cancel_requested_at"),
		cancelledAt: text("cancelled_at"),
		workerId: text("worker_id"),
		processingStartedAt: text("processing_started_at"),
		heartbeatAt: text("heartbeat_at"),
		leaseExpiresAt: text("lease_expires_at"),
		runAttempts: integer("run_attempts").notNull().default(0),
		recoveryAttempts: integer("recovery_attempts").notNull().default(0),
		lastRecoveredAt: text("last_recovered_at"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_background_jobs_user_created").on(table.userId, table.createdAt),
		index("idx_background_jobs_user_status").on(table.userId, table.status),
	],
);

export const backgroundJobEvents = sqliteTable(
	"background_job_events",
	{
		id: text("id").primaryKey(),
		jobId: text("job_id")
			.notNull()
			.references(() => backgroundJobs.id, { onDelete: "cascade" }),
		seq: integer("seq").notNull(),
		payload: text("payload").notNull(),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("uq_background_job_events_job_seq").on(table.jobId, table.seq),
	],
);
