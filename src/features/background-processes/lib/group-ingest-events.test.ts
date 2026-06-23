import { describe, expect, it } from "vitest";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import { PHASE_TEXT } from "@/features/ai/jobs/ingest/run-ingest/constants";
import {
	getIngestGroupStatus,
	groupEventsByPhase,
	INITIALIZATION_GROUP_LABEL,
	isIngestGroupExpanded,
} from "@/features/background-processes/lib/group-ingest-events";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import { INGEST_PHASE, JOB_STATUS } from "@/lib/job-kinds";

function event(
	seq: number,
	payload: JobEventRecord["payload"],
): JobEventRecord {
	return { seq, payload, createdAt: null };
}

describe("groupEventsByPhase", () => {
	it("assigns pre-phase events to Inicialização", () => {
		const groups = groupEventsByPhase([
			event(1, { type: "text", text: "Job enfileirado" }),
			event(2, { type: "text", text: PHASE_TEXT[INGEST_PHASE.READING_FILE] }),
		]);

		expect(groups).toHaveLength(1);
		expect(groups[0]?.label).toBe(INITIALIZATION_GROUP_LABEL);
		expect(groups[0]?.items).toEqual([
			{ type: "event", event: event(1, { type: "text", text: "Job enfileirado" }) },
			{
				type: "event",
				event: event(2, {
					type: "text",
					text: PHASE_TEXT[INGEST_PHASE.READING_FILE],
				}),
			},
		]);
	});

	it("places data-ingest-phase in the previous group before advancing", () => {
		const groups = groupEventsByPhase([
			event(1, { type: "text", text: "Início" }),
			event(2, {
				type: INGEST_DATA_PART.PHASE,
				data: { phase: INGEST_PHASE.READING_FILE },
			}),
			event(3, { type: "text", text: "Arquivo lido: 100 caracteres" }),
			event(4, {
				type: INGEST_DATA_PART.PHASE,
				data: { phase: INGEST_PHASE.EXTRACTING },
			}),
			event(5, {
				type: INGEST_DATA_PART.STREAM_PROGRESS,
				data: { questionsSeen: 2 },
			}),
		]);

		expect(groups.map((g) => g.label)).toEqual([
			INITIALIZATION_GROUP_LABEL,
			"Lendo arquivo",
			"Extraindo questões",
		]);
		expect(groups[0]?.items).toEqual([
			{ type: "event", event: event(1, { type: "text", text: "Início" }) },
			{
				type: "event",
				event: event(2, {
					type: INGEST_DATA_PART.PHASE,
					data: { phase: INGEST_PHASE.READING_FILE },
				}),
			},
		]);
		expect(groups[1]?.items).toEqual([
			{
				type: "system-group",
				id: "Lendo arquivo-system-3",
				state: "closed-history",
				events: [event(3, { type: "text", text: "Arquivo lido: 100 caracteres" })],
			},
			{
				type: "event",
				event: event(4, {
					type: INGEST_DATA_PART.PHASE,
					data: { phase: INGEST_PHASE.EXTRACTING },
				}),
			},
		]);
		expect(groups[2]?.items).toEqual([
			{
				type: "event",
				event: event(5, {
					type: INGEST_DATA_PART.STREAM_PROGRESS,
					data: { questionsSeen: 2 },
				}),
			},
		]);
	});

	it("creates persisting group for persist-phase events", () => {
		const groups = groupEventsByPhase([
			event(1, {
				type: INGEST_DATA_PART.PHASE,
				data: { phase: INGEST_PHASE.PERSISTING },
			}),
			event(2, {
				type: "data-ingest-persist-progress",
				data: { saved: 1, total: 3 },
			}),
		]);

		expect(groups).toHaveLength(2);
		expect(groups[0]?.label).toBe(INITIALIZATION_GROUP_LABEL);
		expect(groups[1]?.label).toBe("Salvando questões");
	});

	it("creates reviewing group before persisting", () => {
		const groups = groupEventsByPhase([
			event(1, {
				type: INGEST_DATA_PART.PHASE,
				data: { phase: INGEST_PHASE.REVIEWING },
			}),
			event(2, {
				type: "text",
				text: "Revisão concluída.",
			}),
		]);

		expect(groups).toHaveLength(2);
		expect(groups[1]?.label).toBe("Revisando questões");
	});

	it("groups consecutive system events inline without deduping repeated kinds", () => {
		const groups = groupEventsByPhase([
			event(1, {
				type: "data-ingest-system-info",
				data: { kind: "file-read", payload: { charCount: 100 } },
			}),
			event(2, {
				type: "data-ingest-system-info",
				data: { kind: "file-read", payload: { charCount: 200 } },
			}),
			event(3, {
				type: INGEST_DATA_PART.STREAM_PROGRESS,
				data: { questionsSeen: 1 },
			}),
			event(4, {
				type: "data-ingest-system-info",
				data: { kind: "llm-call", payload: {} },
			}),
		]);

		expect(groups).toHaveLength(1);
		expect(groups[0]?.items).toEqual([
			{
				type: "system-group",
				id: "Inicialização-system-1",
				state: "closed-history",
				events: [
					event(1, {
						type: "data-ingest-system-info",
						data: { kind: "file-read", payload: { charCount: 100 } },
					}),
					event(2, {
						type: "data-ingest-system-info",
						data: { kind: "file-read", payload: { charCount: 200 } },
					}),
				],
			},
			{
				type: "event",
				event: event(3, {
					type: INGEST_DATA_PART.STREAM_PROGRESS,
					data: { questionsSeen: 1 },
				}),
			},
			{
				type: "system-group",
				id: "Inicialização-system-4",
				state: "active",
				events: [
					event(4, {
						type: "data-ingest-system-info",
						data: { kind: "llm-call", payload: {} },
					}),
				],
			},
		]);
	});

	it("merges system text and system-info in the same inline sequence", () => {
		const groups = groupEventsByPhase([
			event(1, { type: "text", text: "Arquivo lido: 120 caracteres" }),
			event(2, {
				type: "data-ingest-system-info",
				data: { kind: "llm-call", payload: {} },
			}),
		]);

		expect(groups[0]?.items).toEqual([
			{
				type: "system-group",
				id: "Inicialização-system-1",
				state: "active",
				events: [
					event(1, { type: "text", text: "Arquivo lido: 120 caracteres" }),
					event(2, {
						type: "data-ingest-system-info",
						data: { kind: "llm-call", payload: {} },
					}),
				],
			},
		]);
	});

	it("advances phase when the phase signal comes from system-info", () => {
		const groups = groupEventsByPhase([
			event(1, {
				type: "data-ingest-system-info",
				data: { kind: "phase", payload: { phase: INGEST_PHASE.READING_FILE } },
			}),
			event(2, {
				type: "data-ingest-system-info",
				data: { kind: "file-read", payload: { charCount: 90 } },
			}),
		]);

		expect(groups.map((g) => g.label)).toEqual([
			INITIALIZATION_GROUP_LABEL,
			"Lendo arquivo",
		]);
		expect(groups[0]?.items).toEqual([
			{
				type: "system-group",
				id: "Inicialização-system-1",
				state: "closed-history",
				events: [
					event(1, {
						type: "data-ingest-system-info",
						data: {
							kind: "phase",
							payload: { phase: INGEST_PHASE.READING_FILE },
						},
					}),
				],
			},
		]);
		expect(groups[1]?.items).toEqual([
			{
				type: "system-group",
				id: "Lendo arquivo-system-2",
				state: "active",
				events: [
					event(2, {
						type: "data-ingest-system-info",
						data: { kind: "file-read", payload: { charCount: 90 } },
					}),
				],
			},
		]);
	});
});

describe("getIngestGroupStatus", () => {
	const readingGroup = {
		label: "Lendo arquivo",
		phase: INGEST_PHASE.READING_FILE,
		items: [],
	};
	const extractingGroup = {
		label: "Extraindo questões",
		phase: INGEST_PHASE.EXTRACTING,
		items: [],
	};

	it("marks completed groups as done when job finished", () => {
		expect(
			getIngestGroupStatus(readingGroup, JOB_STATUS.COMPLETED, null),
		).toBe("done");
	});

	it("marks the current phase group as active while running", () => {
		expect(
			getIngestGroupStatus(
				extractingGroup,
				JOB_STATUS.RUNNING,
				INGEST_PHASE.EXTRACTING,
			),
		).toBe("active");
		expect(
			getIngestGroupStatus(
				readingGroup,
				JOB_STATUS.RUNNING,
				INGEST_PHASE.EXTRACTING,
			),
		).toBe("done");
	});

	it("marks the failed phase group as failed", () => {
		expect(
			getIngestGroupStatus(
				extractingGroup,
				JOB_STATUS.FAILED,
				INGEST_PHASE.EXTRACTING,
			),
		).toBe("failed");
	});

	it("expands only active and failed phase groups by default", () => {
		expect(isIngestGroupExpanded("active")).toBe(true);
		expect(isIngestGroupExpanded("failed")).toBe(true);
		expect(isIngestGroupExpanded("done")).toBe(false);
		expect(isIngestGroupExpanded("pending")).toBe(false);
	});
});
