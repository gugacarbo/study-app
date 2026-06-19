import type { R2Bucket } from "@cloudflare/workers-types";
import type { generateObject } from "ai";
import type { AppDatabase } from "@/db/client";
import type { PersistQuestionsDeps } from "@/features/ai/jobs/ingest/persist-questions";
import type { getAiModel } from "@/lib/ai-config";

export type BackgroundJobRow = {
	id: string;
	userId: string;
	kind: string;
	status: string;
	phase: string | null;
	error: string | null;
	metadata: string | null;
	cancelRequestedAt: string | null;
};

export type RunIngestDeps = {
	getJobById: (jobId: string) => Promise<BackgroundJobRow | null>;
	updateJobStatus: (
		jobId: string,
		update: {
			status?: string;
			phase?: string | null;
			error?: string | null;
			metadata?: string;
		},
	) => Promise<void>;
	appendJobEvent: (jobId: string, payload: string) => Promise<void>;
	isCancelRequested: (jobId: string) => Promise<boolean>;
	persistQuestionsDeps: PersistQuestionsDeps;
	getAiModel?: typeof getAiModel;
	generateObject?: typeof generateObject;
	sleep?: (ms: number) => Promise<void>;
};

export type RunIngestContext = {
	jobId: string;
	db: AppDatabase;
	filesBucket: R2Bucket;
	deps: RunIngestDeps;
};
