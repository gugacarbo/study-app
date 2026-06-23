import { describe, expect, it } from "vitest";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import { INGEST_PHASE } from "@/lib/job-kinds";
import {
	formatEventDetails,
	formatEventType,
	formatSystemInfoLabel,
	isSystemInfoPart,
} from "@/features/background-processes/lib/ingest-event-labels";

describe("formatSystemInfoLabel", () => {
	it("returns human text for phase READING_FILE", () => {
		expect(
			formatSystemInfoLabel("phase", { phase: INGEST_PHASE.READING_FILE }),
		).toBe("Lendo arquivo…");
	});

	it("returns human text for phase EXTRACTING", () => {
		expect(
			formatSystemInfoLabel("phase", { phase: INGEST_PHASE.EXTRACTING }),
		).toBe("Extraindo questões…");
	});

	it("returns human text for phase PERSISTING", () => {
		expect(
			formatSystemInfoLabel("phase", { phase: INGEST_PHASE.PERSISTING }),
		).toBe("Salvando questões…");
	});

	it("returns human text for phase REVIEWING", () => {
		expect(
			formatSystemInfoLabel("phase", { phase: INGEST_PHASE.REVIEWING }),
		).toBe("Revisando questões…");
	});

	it("returns human text for file-read with charCount", () => {
		expect(
			formatSystemInfoLabel("file-read", { charCount: 1000 }),
		).toBe("Arquivo lido: 1.000 caracteres");
	});

	it("returns human text for llm-call", () => {
		expect(formatSystemInfoLabel("llm-call", {})).toBe(
			"Chamando modelo para extração…",
		);
	});

	it("returns human text for llm-retry with attempt and maxAttempts", () => {
		expect(
			formatSystemInfoLabel("llm-retry", { attempt: 2, maxAttempts: 3 }),
		).toBe("Tentativa 2/3…");
	});

	it("returns human text for persist-validating with total", () => {
		expect(
			formatSystemInfoLabel("persist-validating", { total: 5 }),
		).toBe("Validando 5 questão(ões)…");
	});

	it("returns human text for persist-progress with saved and total", () => {
		expect(
			formatSystemInfoLabel("persist-progress", { saved: 3, total: 10 }),
		).toBe("Salvando 3/10 questão(ões)…");
	});

	it("returns null for unknown kind", () => {
		expect(formatSystemInfoLabel("unknown-kind", {})).toBeNull();
	});
});

describe("formatEventType for system info", () => {
	it("returns Sistema for system info payload", () => {
		expect(
			formatEventType({
				type: INGEST_DATA_PART.SYSTEM_INFO,
				data: {
					kind: "phase",
					payload: { phase: INGEST_PHASE.READING_FILE },
				},
			}),
		).toBe("Sistema");
	});
});

describe("formatEventDetails for system info", () => {
	it("returns array with label/value from payload for phase", () => {
		expect(
			formatEventDetails({
				type: "data-ingest-system-info",
				data: {
					kind: "phase",
					payload: { phase: "reading_file" },
				},
			}),
		).toEqual([{ label: "Fase", value: "Lendo arquivo" }]);
	});

	it("returns array with label/value from payload for file-read", () => {
		expect(
			formatEventDetails({
				type: "data-ingest-system-info",
				data: {
					kind: "file-read",
					payload: { charCount: 1000 },
				},
			}),
		).toEqual([{ label: "Caracteres", value: "1.000" }]);
	});

	it("returns array with label/value from payload for llm-retry", () => {
		expect(
			formatEventDetails({
				type: "data-ingest-system-info",
				data: {
					kind: "llm-retry",
					payload: { attempt: 2, maxAttempts: 3 },
				},
			}),
		).toEqual([
			{ label: "Tentativa", value: "2" },
			{ label: "Máximo", value: "3" },
		]);
	});

	it("returns array with label/value from payload for persist-validating", () => {
		expect(
			formatEventDetails({
				type: "data-ingest-system-info",
				data: {
					kind: "persist-validating",
					payload: { total: 5 },
				},
			}),
		).toEqual([{ label: "Total", value: "5" }]);
	});

	it("returns array with label/value from payload for persist-progress", () => {
		expect(
			formatEventDetails({
				type: "data-ingest-system-info",
				data: {
					kind: "persist-progress",
					payload: { saved: 3, total: 10 },
				},
			}),
		).toEqual([
			{ label: "Salvas", value: "3" },
			{ label: "Total", value: "10" },
		]);
	});
});

describe("isSystemInfoPart", () => {
	it("returns true for valid system info phase", () => {
		expect(
			isSystemInfoPart({
				type: "data-ingest-system-info",
				data: { kind: "phase", payload: { phase: "reading_file" } },
			}),
		).toBe(true);
	});

	it("returns true for valid system info file-read", () => {
		expect(
			isSystemInfoPart({
				type: "data-ingest-system-info",
				data: { kind: "file-read", payload: { charCount: 1000 } },
			}),
		).toBe(true);
	});

	it("returns true for valid system info llm-call", () => {
		expect(
			isSystemInfoPart({
				type: "data-ingest-system-info",
				data: { kind: "llm-call", payload: {} },
			}),
		).toBe(true);
	});

	it("returns true for valid system info llm-retry", () => {
		expect(
			isSystemInfoPart({
				type: "data-ingest-system-info",
				data: { kind: "llm-retry", payload: { attempt: 1, maxAttempts: 3 } },
			}),
		).toBe(true);
	});

	it("returns true for valid system info persist-validating", () => {
		expect(
			isSystemInfoPart({
				type: "data-ingest-system-info",
				data: { kind: "persist-validating", payload: { total: 5 } },
			}),
		).toBe(true);
	});

	it("returns true for valid system info persist-progress", () => {
		expect(
			isSystemInfoPart({
				type: "data-ingest-system-info",
				data: { kind: "persist-progress", payload: { saved: 3, total: 10 } },
			}),
		).toBe(true);
	});

	it("returns true for unknown kind (any non-empty kind is valid)", () => {
		expect(
			isSystemInfoPart({
				type: "data-ingest-system-info",
				data: { kind: "unknown", payload: {} },
			}),
		).toBe(true);
	});

	it("returns false for non-system-info payload", () => {
		expect(
			isSystemInfoPart({
				type: INGEST_DATA_PART.PHASE,
				data: { phase: "READING_FILE" },
			}),
		).toBe(false);
	});

	it("returns false for plain object without type", () => {
		expect(isSystemInfoPart({ foo: "bar" })).toBe(false);
	});

	it("returns false for null", () => {
		expect(isSystemInfoPart(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isSystemInfoPart(undefined)).toBe(false);
	});
});
