import { describe, expect, it } from "vitest";
import { GENERATE_EXAM_PHASE_LABELS } from "@/features/background-processes/lib/ingest-event-labels";
import {
	isGenerateExamEvent,
	mapGenerateExamProgress,
} from "@/features/background-processes/lib/ingest-event-mapper";
import { GENERATE_EXAM_PHASE } from "@/lib/job-kinds";

describe("GENERATE_EXAM_PHASE_LABELS", () => {
	it("has all 4 phases with correct labels", () => {
		expect(GENERATE_EXAM_PHASE_LABELS).toEqual({
			[GENERATE_EXAM_PHASE.READING_CONTEXT]: "Lendo conteúdo",
			[GENERATE_EXAM_PHASE.PARSING_CONTEXT_FILES]: "Processando arquivos",
			[GENERATE_EXAM_PHASE.GENERATING_QUESTIONS]: "Gerando questões",
			[GENERATE_EXAM_PHASE.PERSISTING]: "Salvando questões",
		});
	});
});

describe("isGenerateExamEvent", () => {
	it("returns true for valid generate-exam phase event", () => {
		expect(
			isGenerateExamEvent({
				type: "data-generate-exam-phase",
				data: { phase: GENERATE_EXAM_PHASE.READING_CONTEXT },
			}),
		).toBe(true);
	});

	it("returns true for parsing_context_files phase", () => {
		expect(
			isGenerateExamEvent({
				type: "data-generate-exam-phase",
				data: { phase: GENERATE_EXAM_PHASE.PARSING_CONTEXT_FILES },
			}),
		).toBe(true);
	});

	it("returns true for generating_questions phase", () => {
		expect(
			isGenerateExamEvent({
				type: "data-generate-exam-phase",
				data: { phase: GENERATE_EXAM_PHASE.GENERATING_QUESTIONS },
			}),
		).toBe(true);
	});

	it("returns true for persisting phase", () => {
		expect(
			isGenerateExamEvent({
				type: "data-generate-exam-phase",
				data: { phase: GENERATE_EXAM_PHASE.PERSISTING },
			}),
		).toBe(true);
	});

	it("returns false for null payload", () => {
		expect(isGenerateExamEvent(null)).toBe(false);
	});

	it("returns false for non-object payload", () => {
		expect(isGenerateExamEvent("string")).toBe(false);
	});

	it("returns false for wrong type", () => {
		expect(
			isGenerateExamEvent({
				type: "data-ingest-system-info",
				data: { kind: "phase", payload: { phase: "reading_file" } },
			}),
		).toBe(false);
	});

	it("returns false for missing data", () => {
		expect(
			isGenerateExamEvent({
				type: "data-generate-exam-phase",
			}),
		).toBe(false);
	});

	it("returns false for invalid phase value", () => {
		expect(
			isGenerateExamEvent({
				type: "data-generate-exam-phase",
				data: { phase: "invalid_phase" },
			}),
		).toBe(false);
	});
});

describe("mapGenerateExamProgress", () => {
	it("returns initial progress for empty events", () => {
		const result = mapGenerateExamProgress([]);
		expect(result).toEqual({
			phase: null,
			parsedCount: 0,
			totalFiles: 0,
			questionsGenerated: 0,
			persistedCount: 0,
		});
	});

	it("returns correct progress for reading_context phase event", () => {
		const events = [
			{
				seq: 1,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.READING_CONTEXT },
				},
				createdAt: "2026-07-07T00:00:00.000Z",
			},
		];

		const result = mapGenerateExamProgress(events);
		expect(result.phase).toBe(GENERATE_EXAM_PHASE.READING_CONTEXT);
	});

	it("returns correct progress for parsing_context_files phase event", () => {
		const events = [
			{
				seq: 1,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.PARSING_CONTEXT_FILES },
				},
				createdAt: "2026-07-07T00:00:00.000Z",
			},
		];

		const result = mapGenerateExamProgress(events);
		expect(result.phase).toBe(GENERATE_EXAM_PHASE.PARSING_CONTEXT_FILES);
	});

	it("returns correct progress for generating_questions phase event", () => {
		const events = [
			{
				seq: 1,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.GENERATING_QUESTIONS },
				},
				createdAt: "2026-07-07T00:00:00.000Z",
			},
		];

		const result = mapGenerateExamProgress(events);
		expect(result.phase).toBe(GENERATE_EXAM_PHASE.GENERATING_QUESTIONS);
	});

	it("returns correct progress for persisting phase event", () => {
		const events = [
			{
				seq: 1,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.PERSISTING },
				},
				createdAt: "2026-07-07T00:00:00.000Z",
			},
		];

		const result = mapGenerateExamProgress(events);
		expect(result.phase).toBe(GENERATE_EXAM_PHASE.PERSISTING);
	});

	it("tracks phase progression through multiple events", () => {
		const events = [
			{
				seq: 1,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.READING_CONTEXT },
				},
				createdAt: "2026-07-07T00:00:00.000Z",
			},
			{
				seq: 2,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.PARSING_CONTEXT_FILES },
				},
				createdAt: "2026-07-07T00:00:01.000Z",
			},
			{
				seq: 3,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.GENERATING_QUESTIONS },
				},
				createdAt: "2026-07-07T00:00:02.000Z",
			},
			{
				seq: 4,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.PERSISTING },
				},
				createdAt: "2026-07-07T00:00:03.000Z",
			},
		];

		const result = mapGenerateExamProgress(events);
		expect(result.phase).toBe(GENERATE_EXAM_PHASE.PERSISTING);
	});

	it("ignores non-generate-exam events", () => {
		const events = [
			{
				seq: 1,
				payload: {
					type: "text",
					text: "Lendo conteudo...",
				},
				createdAt: "2026-07-07T00:00:00.000Z",
			},
			{
				seq: 2,
				payload: {
					type: "data-generate-exam-phase",
					data: { phase: GENERATE_EXAM_PHASE.READING_CONTEXT },
				},
				createdAt: "2026-07-07T00:00:01.000Z",
			},
		];

		const result = mapGenerateExamProgress(events);
		expect(result.phase).toBe(GENERATE_EXAM_PHASE.READING_CONTEXT);
	});
});
