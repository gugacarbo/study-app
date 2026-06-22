import { describe, expect, it } from "vitest";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import { PHASE_TEXT } from "@/features/ai/jobs/ingest/run-ingest/constants";
import {
	getIngestGroupStatus,
	groupEventsByPhase,
	INITIALIZATION_GROUP_LABEL,
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
		expect(groups[0]?.events).toHaveLength(2);
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
		expect(groups[0]?.events.map((e) => e.seq)).toEqual([1, 2]);
		expect(groups[1]?.events.map((e) => e.seq)).toEqual([3, 4]);
		expect(groups[2]?.events.map((e) => e.seq)).toEqual([5]);
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
});

describe("getIngestGroupStatus", () => {
	const readingGroup = {
		label: "Lendo arquivo",
		phase: INGEST_PHASE.READING_FILE,
		events: [],
	};
	const extractingGroup = {
		label: "Extraindo questões",
		phase: INGEST_PHASE.EXTRACTING,
		events: [],
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
});
