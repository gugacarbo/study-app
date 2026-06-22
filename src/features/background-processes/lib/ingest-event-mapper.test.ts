import { describe, expect, it } from "vitest";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import { PHASE_TEXT } from "@/features/ai/jobs/ingest/run-ingest/constants";
import {
	formatEventDetails,
	formatEventLabel,
	formatEventType,
	INGEST_SYSTEM_TEXT,
	isPhaseStatusText,
	roleForPayload,
} from "@/features/background-processes/lib/ingest-event-labels";
import {
	INITIAL_INGEST_PROGRESS,
	mergeJobEvents,
	mergeStreamParts,
} from "@/features/background-processes/lib/ingest-event-mapper";
import { INGEST_PHASE } from "@/lib/job-kinds";

const emptyState = {
	messages: [],
	progress: INITIAL_INGEST_PROGRESS,
	lastSeq: 0,
	events: [],
};

describe("mergeJobEvents", () => {
	it("updates phase without creating a chat message", () => {
		const event = {
			seq: 1,
			payload: {
				type: INGEST_DATA_PART.PHASE,
				data: { phase: INGEST_PHASE.READING_FILE },
			},
			createdAt: "2026-06-18T00:00:00.000Z",
		};
		const result = mergeJobEvents(emptyState, [event]);

		expect(result.messages).toHaveLength(0);
		expect(result.progress.phase).toBe(INGEST_PHASE.READING_FILE);
		expect(result.lastSeq).toBe(1);
	});

	it("maps phase status text to system role", () => {
		const result = mergeJobEvents(emptyState, [
			{
				seq: 1,
				payload: { type: "text", text: PHASE_TEXT[INGEST_PHASE.READING_FILE] },
				createdAt: null,
			},
		]);

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]?.role).toBe("system");
		expect(result.messages[0]?.content).toContain("Lendo o arquivo");
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

	it("tracks stream progress as assistant message", () => {
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
		expect(result.messages[0]?.role).toBe("assistant");
		expect(result.messages[0]?.content).toContain("5 questões");
	});

	it("maps persist progress as assistant message", () => {
		const result = mergeJobEvents(emptyState, [
			{
				seq: 4,
				payload: {
					type: INGEST_DATA_PART.PERSIST_PROGRESS,
					data: { saved: 3, total: 12 },
				},
				createdAt: null,
			},
		]);

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]?.role).toBe("assistant");
		expect(result.messages[0]?.content).toBe(
			"Salvando 3/12 questão(ões)…",
		);
	});

	it("maps summary part as assistant", () => {
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
		expect(result.messages[0]?.role).toBe("assistant");
		expect(result.messages[0]?.content).toContain("8 questão");
	});

	it("skips duplicate chat messages with identical content", () => {
		const completionText =
			"Importação concluída: 8 questão(ões) salva(s).";
		const afterSummary = mergeJobEvents(emptyState, [
			{
				seq: 1,
				payload: {
					type: INGEST_DATA_PART.SUMMARY,
					data: {
						extracted: 8,
						persisted: 8,
						skippedDuplicate: 0,
						invalid: 0,
					},
				},
				createdAt: null,
			},
		]);

		const result = mergeJobEvents(afterSummary, [
			{
				seq: 2,
				payload: { type: "text", text: completionText },
				createdAt: null,
			},
		]);

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]?.content).toBe(completionText);
	});

	it("groups stream parts by messageId into assistant messages", () => {
		const result = mergeJobEvents(emptyState, [
			{
				seq: 1,
				payload: {
					type: "reasoning-delta",
					messageId: "ingest-step-1",
					delta: "Analisando",
				},
				createdAt: null,
			},
			{
				seq: 2,
				payload: {
					type: "text",
					messageId: "ingest-step-1",
					text: " enunciado…",
				},
				createdAt: null,
			},
		]);

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]?.id).toBe("ingest-step-1");
		expect(result.messages[0]?.role).toBe("assistant");
		expect(result.messages[0]?.content).toEqual([
			{ type: "reasoning", text: "Analisando" },
			{ type: "text", text: " enunciado…" },
		]);
		expect(result.messages[0]?.status).toBe("running");
	});

	it("creates separate assistant messages per messageId", () => {
		const result = mergeJobEvents(emptyState, [
			{
				seq: 1,
				payload: {
					type: "text",
					messageId: "ingest-step-1",
					text: "Primeiro passo",
				},
				createdAt: null,
			},
			{
				seq: 2,
				payload: {
					type: "text",
					messageId: "ingest-step-2",
					text: "Segundo passo",
				},
				createdAt: null,
			},
		]);

		expect(result.messages).toHaveLength(2);
		expect(result.messages[0]?.id).toBe("ingest-step-1");
		expect(result.messages[1]?.id).toBe("ingest-step-2");
		expect(result.messages[0]?.status).toBe("complete");
		expect(result.messages[1]?.status).toBe("running");
	});

	it("marks last assistant stream message complete when job is terminal", () => {
		const running = mergeJobEvents(emptyState, [
			{
				seq: 1,
				payload: {
					type: "reasoning",
					messageId: "ingest-step-1",
					text: "Pensando…",
				},
				createdAt: null,
			},
		]);

		const result = mergeJobEvents(
			{ ...running, isJobTerminal: true },
			[],
		);

		expect(result.messages[0]?.status).toBe("complete");
	});
});

describe("mergeStreamParts", () => {
	it("concatenates reasoning-delta into a reasoning part", () => {
		const messageId = "ingest-step-1";
		let state = mergeStreamParts(new Map(), {
			type: "reasoning-delta",
			messageId,
			delta: "foo",
		});
		state = mergeStreamParts(state, {
			type: "reasoning-delta",
			messageId,
			delta: "bar",
		});

		expect(state.get(messageId)).toEqual([{ type: "reasoning", text: "foobar" }]);
	});

	it("replaces reasoning text on reasoning flush", () => {
		const messageId = "ingest-step-1";
		let state = mergeStreamParts(new Map(), {
			type: "reasoning-delta",
			messageId,
			delta: "partial",
		});
		state = mergeStreamParts(state, {
			type: "reasoning",
			messageId,
			text: "final reasoning",
		});

		expect(state.get(messageId)).toEqual([
			{ type: "reasoning", text: "final reasoning" },
		]);
	});

	it("merges tool-call and tool-result by toolCallId", () => {
		const messageId = "ingest-step-1";
		let state = mergeStreamParts(new Map(), {
			type: "tool-call",
			messageId,
			toolCallId: "tc-1",
			toolName: "submit_question",
			argsText: '{"n":1}',
			state: "running",
		});
		state = mergeStreamParts(state, {
			type: "tool-result",
			messageId,
			toolCallId: "tc-1",
			result: { ok: true, index: 0 },
		});

		expect(state.get(messageId)).toEqual([
			{
				type: "tool-call",
				toolCallId: "tc-1",
				toolName: "submit_question",
				argsText: '{"n":1}',
				args: { n: 1 },
				result: { ok: true, index: 0 },
			},
		]);
	});

	it("keeps tool-call running when result has not arrived", () => {
		const messageId = "ingest-step-1";
		const state = mergeStreamParts(new Map(), {
			type: "tool-call",
			messageId,
			toolCallId: "tc-1",
			toolName: "submit_question",
			argsText: "{}",
			state: "running",
		});

		const part = state.get(messageId)?.[0];
		expect(part?.type).toBe("tool-call");
		if (part?.type === "tool-call") {
			expect(part.result).toBeUndefined();
		}
	});
});

describe("formatEventLabel", () => {
	it("returns null for unknown payloads", () => {
		expect(formatEventLabel({ foo: "bar" })).toBeNull();
	});

	it("formats persist progress", () => {
		expect(
			formatEventLabel({
				type: INGEST_DATA_PART.PERSIST_PROGRESS,
				data: { saved: 5, total: 12 },
			}),
		).toBe("Salvando 5/12 questão(ões)…");
	});

	it("passes through frozen system text events", () => {
		expect(
			formatEventLabel({
				type: "text",
				text: "Arquivo lido: 4.832 caracteres",
			}),
		).toBe("Arquivo lido: 4.832 caracteres");
		expect(
			formatEventLabel({
				type: "text",
				text: INGEST_SYSTEM_TEXT.LLM_CALL,
			}),
		).toBe("Chamando modelo para extração…");
		expect(
			formatEventLabel({ type: "text", text: "Tentativa 2/3…" }),
		).toBe("Tentativa 2/3…");
		expect(
			formatEventLabel({
				type: "text",
				text: "Validando 12 questão(ões)…",
			}),
		).toBe("Validando 12 questão(ões)…");
	});
});

describe("formatEventType", () => {
	it("classifies unknown payloads as Outro", () => {
		expect(formatEventType({ foo: "bar" })).toBe("Outro");
	});

	it("classifies stream reasoning as Raciocínio", () => {
		expect(
			formatEventType({
				type: "reasoning-delta",
				messageId: "ingest-step-1",
				delta: "…",
			}),
		).toBe("Raciocínio");
	});

	it("classifies stream tool events as Tool", () => {
		expect(
			formatEventType({
				type: "tool-call",
				messageId: "ingest-step-1",
				toolCallId: "tc-1",
				toolName: "submit_question",
				argsText: "{}",
				state: "running",
			}),
		).toBe("Tool");
	});

	it("classifies assistant stream text as Texto", () => {
		expect(
			formatEventType({
				type: "text",
				messageId: "ingest-step-1",
				text: "Olá",
			}),
		).toBe("Texto");
	});

	it("classifies persist progress as Persistência", () => {
		expect(
			formatEventType({
				type: INGEST_DATA_PART.PERSIST_PROGRESS,
				data: { saved: 1, total: 1 },
			}),
		).toBe("Persistência");
	});
});

describe("formatEventDetails", () => {
	it("returns saved and total for persist progress", () => {
		expect(
			formatEventDetails({
				type: INGEST_DATA_PART.PERSIST_PROGRESS,
				data: { saved: 7, total: 10 },
			}),
		).toEqual([
			{ label: "Salvas", value: "7" },
			{ label: "Total", value: "10" },
		]);
	});
});

describe("isPhaseStatusText", () => {
	it.each([
		PHASE_TEXT[INGEST_PHASE.READING_FILE],
		PHASE_TEXT[INGEST_PHASE.EXTRACTING],
		PHASE_TEXT[INGEST_PHASE.PERSISTING],
		INGEST_SYSTEM_TEXT.LLM_CALL,
		"Arquivo lido: 4.832 caracteres",
		"Tentativa 2/3…",
		"Validando 12 questão(ões)…",
	])("recognizes frozen system text: %s", (text) => {
		expect(isPhaseStatusText(text)).toBe(true);
	});

	it("rejects non-system assistant text", () => {
		expect(isPhaseStatusText("Identifiquei 5 questões até agora…")).toBe(
			false,
		);
	});
});

describe("roleForPayload", () => {
	it.each([
		PHASE_TEXT[INGEST_PHASE.READING_FILE],
		PHASE_TEXT[INGEST_PHASE.EXTRACTING],
		PHASE_TEXT[INGEST_PHASE.PERSISTING],
		INGEST_SYSTEM_TEXT.LLM_CALL,
		"Arquivo lido: 1.000 caracteres",
		"Tentativa 3/3…",
		"Validando 1 questão(ões)…",
	])("maps frozen system text to system role: %s", (text) => {
		expect(roleForPayload({ type: "text", text })).toBe("system");
	});

	it("maps persist progress to assistant role", () => {
		expect(
			roleForPayload({
				type: INGEST_DATA_PART.PERSIST_PROGRESS,
				data: { saved: 2, total: 5 },
			}),
		).toBe("assistant");
	});
});
