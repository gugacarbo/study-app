import { describe, expect, it } from "vitest";
import {
	applyTokenEvent,
	applyWarningEvent,
	clearCompletedJobsFromState,
	hydrateIngestStateFromStorage,
	INGEST_STORAGE_KEY,
	serializeIngestStateForStorage,
	syncJobTokenTotals,
	upsertAgentRun,
} from "@/features/ingest/store";
import type {
	IngestAgentRun,
	IngestJob,
	IngestStoreState,
} from "@/features/ingest/store";
import type { IngestAgentEvent, IngestTokenEvent } from "@/lib/sse-stream";

function createJob(overrides?: Partial<IngestJob>): IngestJob {
	return {
		id: "job-1",
		fileName: "exam.txt",
		status: "running",
		createdAt: 1,
		startedAt: 2,
		finishedAt: null,
		stepText: "Running review",
		logs: [],
		outputEntries: [],
		agentRuns: [],
		tokenTotals: { prompt: 0, completion: 0, total: 0 },
		nonAgentTokenTotals: { prompt: 0, completion: 0, total: 0 },
		warnings: [],
		result: null,
		error: null,
		flowStages: [],
		buffer: [],
		enableReview: true,
		rawStreamText: "",
		...overrides,
	};
}

function agentEvent(
	overrides?: Partial<IngestAgentEvent>,
): IngestAgentEvent {
	return {
		agentRunId: "agent-1",
		stageId: "review",
		label: "Reviewer Q1",
		status: "running",
		timestamp: 1,
		...overrides,
	};
}

function tokenEvent(
	overrides?: Partial<IngestTokenEvent>,
): IngestTokenEvent {
	return {
		prompt: 10,
		completion: 20,
		total: 30,
		...overrides,
	};
}

function makeAgentRun(
	overrides?: Partial<IngestAgentRun>,
): IngestAgentRun {
	return {
		id: "agent-1",
		stageId: "review",
		label: "Reviewer Q1",
		status: "running",
		timestamp: 1,
		systemPrompt: "",
		userPrompt: "",
		outputText: "",
		rawOutput: null,
		error: null,
		warnings: [],
		tokenTotals: { prompt: 0, completion: 0, total: 0 },
		...overrides,
	};
}

function createState(overrides?: Partial<IngestStoreState>): IngestStoreState {
	return {
		jobs: [],
		focusedJobId: null,
		...overrides,
	};
}

describe("applyWarningEvent", () => {
	it("sets agent status to warning when no existing status", () => {
		const job = createJob({
			agentRuns: [
				makeAgentRun({ id: "agent-1", status: "running" }),
			],
		});

		const updated = applyWarningEvent(job, "low confidence", {
			message: "low confidence",
			agentRunId: "agent-1",
			stageId: "review",
			timestamp: 10,
		});

		const agent = updated.agentRuns[0];
		expect(agent.status).toBe("warning");
		expect(agent.warnings).toContain("low confidence");
	});

	it("preserves error status when warning arrives after error (error is terminal)", () => {
		const job = createJob({
			agentRuns: [
				makeAgentRun({
					id: "agent-1",
					status: "error",
					error: "Review failed",
					warnings: [],
				}),
			],
		});

		const updated = applyWarningEvent(job, "subsequent warning", {
			message: "subsequent warning",
			agentRunId: "agent-1",
			stageId: "review",
			timestamp: 20,
		});

		const agent = updated.agentRuns[0];
		expect(agent.status).toBe("error");
		expect(agent.error).toBe("Review failed");
		expect(agent.warnings).toContain("subsequent warning");
	});
});

describe("upsertAgentRun", () => {
	it("updates agent token totals via tokens field", () => {
		const job = createJob();

		const updated = upsertAgentRun(
			job,
			agentEvent({
				agentRunId: "agent-1",
				tokens: { prompt: 100, completion: 200, total: 300 },
			}),
		);

		expect(updated.agentRuns).toHaveLength(1);
		expect(updated.agentRuns[0].tokenTotals).toEqual({
			prompt: 100,
			completion: 200,
			total: 300,
		});
	});
});

describe("applyTokenEvent", () => {
	it("without agentRunId adds tokens to both job.tokenTotals and nonAgentTokenTotals", () => {
		const job = createJob();

		const updated = applyTokenEvent(job, tokenEvent());

		expect(updated.tokenTotals).toEqual({ prompt: 10, completion: 20, total: 30 });
		expect(updated.nonAgentTokenTotals).toEqual({ prompt: 10, completion: 20, total: 30 });
	});

	it("without agentRunId accumulates non-agent tokens across multiple events", () => {
		const job = createJob();

		const first = applyTokenEvent(job, tokenEvent({ prompt: 5, completion: 5, total: 10 }));
		const second = applyTokenEvent(first, tokenEvent({ prompt: 3, completion: 7, total: 10 }));

		expect(second.tokenTotals).toEqual({ prompt: 8, completion: 12, total: 20 });
		expect(second.nonAgentTokenTotals).toEqual({ prompt: 8, completion: 12, total: 20 });
	});

	it("with agentRunId updates agent and job totals include non-agent pool", () => {
		const job = createJob({
			nonAgentTokenTotals: { prompt: 5, completion: 5, total: 10 },
			tokenTotals: { prompt: 5, completion: 5, total: 10 },
		});

		const updated = applyTokenEvent(
			job,
			tokenEvent({
				agentRunId: "agent-1",
				prompt: 50,
				completion: 100,
				total: 150,
			}),
		);

		expect(updated.agentRuns).toHaveLength(1);
		expect(updated.agentRuns[0].tokenTotals).toEqual({
			prompt: 50,
			completion: 100,
			total: 150,
		});
		expect(updated.tokenTotals).toEqual({
			prompt: 55,
			completion: 105,
			total: 160,
		});
		expect(updated.nonAgentTokenTotals).toEqual({
			prompt: 5,
			completion: 5,
			total: 10,
		});
	});

	it("multiple agent tokens sum in job totals with non-agent tokens preserved", () => {
		const job = createJob();

		const withNonAgent = applyTokenEvent(
			job,
			tokenEvent({ prompt: 10, completion: 20, total: 30 }),
		);

		const withAgent1 = applyTokenEvent(
			withNonAgent,
			tokenEvent({
				agentRunId: "agent-1",
				prompt: 100,
				completion: 200,
				total: 300,
			}),
		);

		const withAgent2 = applyTokenEvent(
			withAgent1,
			tokenEvent({
				agentRunId: "agent-2",
				prompt: 50,
				completion: 100,
				total: 150,
			}),
		);

		expect(withAgent2.agentRuns).toHaveLength(2);
		expect(withAgent2.tokenTotals).toEqual({
			prompt: 160,
			completion: 320,
			total: 480,
		});
		expect(withAgent2.nonAgentTokenTotals).toEqual({
			prompt: 10,
			completion: 20,
			total: 30,
		});
	});
});

describe("syncJobTokenTotals", () => {
	it("combines agent totals with non-agent pool", () => {
		const job = createJob({
			agentRuns: [
				makeAgentRun({
					id: "agent-1",
					tokenTotals: { prompt: 100, completion: 200, total: 300 },
				}),
				makeAgentRun({
					id: "agent-2",
					tokenTotals: { prompt: 50, completion: 75, total: 125 },
				}),
			],
			nonAgentTokenTotals: { prompt: 30, completion: 40, total: 70 },
		});

		const result = syncJobTokenTotals(job);

		expect(result.tokenTotals).toEqual({
			prompt: 180,
			completion: 315,
			total: 495,
		});
	});

	it("returns zero totals when no agents and no non-agent tokens", () => {
		const job = createJob();

		const result = syncJobTokenTotals(job);

		expect(result.tokenTotals).toEqual({
			prompt: 0,
			completion: 0,
			total: 0,
		});
	});

	it("preserves non-agent tokens when agent totals are zero", () => {
		const job = createJob({
			nonAgentTokenTotals: { prompt: 20, completion: 30, total: 50 },
		});

		const result = syncJobTokenTotals(job);

		expect(result.tokenTotals).toEqual({
			prompt: 20,
			completion: 30,
			total: 50,
		});
	});
});

describe("ingest storage persistence", () => {
	it("serializes jobs without persisting raw file buffers", () => {
		const state = createState({
			jobs: [
				createJob({
					id: "job-persisted",
					buffer: [1, 2, 3],
					status: "success",
				}),
			],
			focusedJobId: "job-persisted",
		});

		const serialized = serializeIngestStateForStorage(state);
		const parsed = JSON.parse(serialized) as IngestStoreState;

		expect(parsed.focusedJobId).toBe("job-persisted");
		expect(parsed.jobs).toHaveLength(1);
		expect(parsed.jobs[0]).not.toHaveProperty("buffer");
	});

	it("hydrates queued and running jobs as canceled after reload", () => {
		const saved = JSON.stringify({
			jobs: [
				{
					...createJob({
						id: "job-running",
						status: "running",
						buffer: [9, 9, 9],
						finishedAt: null,
					}),
				},
				{
					...createJob({
						id: "job-done",
						status: "success",
						finishedAt: 20,
					}),
				},
			],
			focusedJobId: "job-running",
		});

		const hydrated = hydrateIngestStateFromStorage(saved);

		expect(hydrated.jobs).toHaveLength(2);
		expect(hydrated.jobs[0]).toMatchObject({
			id: "job-running",
			status: "canceled",
			buffer: [],
			error: "Ingest interrupted after page reload",
			stepText: "Interrupted after reload",
		});
		expect(hydrated.jobs[0].finishedAt).toBeTypeOf("number");
		expect(hydrated.jobs[1]).toMatchObject({
			id: "job-done",
			status: "success",
			buffer: [],
		});
		expect(hydrated.focusedJobId).toBe("job-running");
	});

	it("clears only completed jobs from state", () => {
		const state = createState({
			jobs: [
				createJob({ id: "job-running", status: "running" }),
				createJob({ id: "job-success", status: "success", finishedAt: 10 }),
				createJob({ id: "job-error", status: "error", finishedAt: 11 }),
			],
			focusedJobId: "job-error",
		});

		const nextState = clearCompletedJobsFromState(state);

		expect(nextState.jobs.map((job) => job.id)).toEqual(["job-running"]);
		expect(nextState.focusedJobId).toBeNull();
	});

	it("uses the expected localStorage key", () => {
		expect(INGEST_STORAGE_KEY).toBe("ingest-jobs");
	});
});
