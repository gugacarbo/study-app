import type { D1Database, Queue } from "@cloudflare/workers-types";

export const env = {
	DB: {} as D1Database,
	JOB_QUEUE: {
		send: async () => ({ metadata: { metrics: { queueLagMs: 0 } } }),
		sendBatch: async () => ({ metadata: { metrics: { queueLagMs: 0 } } }),
		metrics: async () => ({
			backlogCount: 0,
			backlogBytes: 0,
			consumerCount: 0,
			messageCount: 0,
			producedCount: 0,
			scheduledCount: 0,
		}),
	} as unknown as Queue<{ jobId: string }>,
	BETTER_AUTH_SECRET: "x".repeat(32),
	BETTER_AUTH_URL: "http://localhost:3000",
	ALLOWED_SIGNUP_EMAIL_DOMAINS: "aluno.ifsc.edu.br",
	EMAIL_FROM_ADDRESS: "noreply@gugacarbo.space",
	EMAIL_FROM_NAME: "Study App",
	ADMIN_EMAILS: "",
};
