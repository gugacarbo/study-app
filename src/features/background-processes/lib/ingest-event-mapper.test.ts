import { describe, expect, it } from "vitest";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import {
	INITIAL_INGEST_PROGRESS,
	mergeJobEvents,
} from "@/features/background-processes/lib/ingest-event-mapper";
import { INGEST_PHASE } from "@/lib/job-kinds";

const emptyState = {
	messages: [],
	progress: INITIAL_INGEST_PROGRESS,
	lastSeq: 0,
	events: [],
};

describe("mergeJobEvents", () => {
	it("maps phase data part to assistant message", () => {
		const event = {
			seq: 1,
			payload: {
				type: INGEST_DATA_PART.PHASE,
				data: { phase: INGEST_PHASE.READING_FILE },
			},
			createdAt: "2026-06-18T00:00:00.000Z",
		};
		const result = mergeJobEvents(emptyState, [event]);

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]?.content).toContain("Lendo arquivo");
		expect(result.progress.phase).toBe(INGEST_PHASE.READING_FILE);
		expect(result.lastSeq).toBe(1);
		expect(result.events).toEqual([event]);
	});

	it("deduplicates by seq", () => {
		const initial = mergeJobEvents(emptyState, [
			{
				seq: 1,
				payload: { type: "text", text: "Olá" },
				createdAt: null,
			},
		]);

		const again = mergeJobEvents(
			{
				messages: initial.messages,
				progress: initial.progress,
				lastSeq: initial.lastSeq,
				events: initial.events,
			},
			[
				{
					seq: 1,
					payload: { type: "text", text: "Olá" },
					createdAt: null,
				},
			],
		);

		expect(again.messages).toHaveLength(1);
		expect(again.events).toHaveLength(1);
	});

	it("tracks stream progress count", () => {
		const result = mergeJobEvents(emptyState, [
			{
				seq: 2,
				payload: {
					type: INGEST_DATA_PART.STREAM_PROGRESS,
					data: { questionsSeen: 5 },
				},
				createdAt: null,
			},
		]);

		expect(result.progress.questionsSeen).toBe(5);
		expect(result.messages[0]?.content).toContain("5 questões");
	});

	it("maps summary part", () => {
		const result = mergeJobEvents(emptyState, [
			{
				seq: 3,
				payload: {
					type: INGEST_DATA_PART.SUMMARY,
					data: {
						extracted: 10,
						persisted: 8,
						skippedDuplicate: 2,
						invalid: 0,
					},
				},
				createdAt: null,
			},
		]);

		expect(result.progress.persisted).toBe(8);
		expect(result.messages[0]?.content).toContain("8 questão");
	});
});
