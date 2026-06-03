import { ingestStore } from "./store";
import type { IngestJob } from "./types";

export function jobById(jobId: string): IngestJob | undefined {
	return ingestStore.state.jobs.find((job) => job.id === jobId);
}

export function activeJobs(): IngestJob[] {
	return ingestStore.state.jobs.filter(
		(job) => job.status === "queued" || job.status === "running",
	);
}

export function recentJobs(limit = 5): IngestJob[] {
	return ingestStore.state.jobs.slice(-limit).reverse();
}
