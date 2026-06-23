import { describe, expect, it } from "vitest";
import {
	INGEST_DATA_PART,
	buildIngestPhaseSystemInfo,
	buildIngestFileReadSystemInfo,
	buildIngestLlmCallSystemInfo,
	buildIngestLlmRetrySystemInfo,
	buildIngestPersistValidatingSystemInfo,
	buildIngestPersistProgressSystemInfo,
} from "@/features/ai/jobs/ingest/ingest-events";
import { INGEST_PHASE } from "@/lib/job-kinds";

describe("INGEST_DATA_PART", () => {
	it("has SYSTEM_INFO constant", () => {
		expect(INGEST_DATA_PART.SYSTEM_INFO).toBe("data-ingest-system-info");
	});
});

describe("buildIngestPhaseSystemInfo", () => {
	it("returns correct structure for READING_FILE phase", () => {
		const result = buildIngestPhaseSystemInfo(INGEST_PHASE.READING_FILE);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "phase", payload: { phase: INGEST_PHASE.READING_FILE } },
		});
	});

	it("returns correct structure for EXTRACTING phase", () => {
		const result = buildIngestPhaseSystemInfo(INGEST_PHASE.EXTRACTING);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "phase", payload: { phase: INGEST_PHASE.EXTRACTING } },
		});
	});

	it("returns correct structure for PERSISTING phase", () => {
		const result = buildIngestPhaseSystemInfo(INGEST_PHASE.PERSISTING);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "phase", payload: { phase: INGEST_PHASE.PERSISTING } },
		});
	});

	it("returns correct structure for REVIEWING phase", () => {
		const result = buildIngestPhaseSystemInfo(INGEST_PHASE.REVIEWING);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "phase", payload: { phase: INGEST_PHASE.REVIEWING } },
		});
	});
});

describe("buildIngestFileReadSystemInfo", () => {
	it("returns correct structure with charCount", () => {
		const result = buildIngestFileReadSystemInfo(1234);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "file-read", payload: { charCount: 1234 } },
		});
	});

	it("returns correct structure with zero charCount", () => {
		const result = buildIngestFileReadSystemInfo(0);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "file-read", payload: { charCount: 0 } },
		});
	});
});

describe("buildIngestLlmCallSystemInfo", () => {
	it("returns correct structure with empty payload", () => {
		const result = buildIngestLlmCallSystemInfo();
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "llm-call", payload: {} },
		});
	});
});

describe("buildIngestLlmRetrySystemInfo", () => {
	it("returns correct structure with attempt and maxAttempts", () => {
		const result = buildIngestLlmRetrySystemInfo(2, 3);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "llm-retry", payload: { attempt: 2, maxAttempts: 3 } },
		});
	});

	it("returns correct structure for first attempt", () => {
		const result = buildIngestLlmRetrySystemInfo(1, 3);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "llm-retry", payload: { attempt: 1, maxAttempts: 3 } },
		});
	});
});

describe("buildIngestPersistValidatingSystemInfo", () => {
	it("returns correct structure with total", () => {
		const result = buildIngestPersistValidatingSystemInfo(10);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "persist-validating", payload: { total: 10 } },
		});
	});

	it("returns correct structure with zero total", () => {
		const result = buildIngestPersistValidatingSystemInfo(0);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "persist-validating", payload: { total: 0 } },
		});
	});
});

describe("buildIngestPersistProgressSystemInfo", () => {
	it("returns correct structure with saved and total", () => {
		const result = buildIngestPersistProgressSystemInfo(5, 10);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "persist-progress", payload: { saved: 5, total: 10 } },
		});
	});

	it("returns correct structure when all saved", () => {
		const result = buildIngestPersistProgressSystemInfo(10, 10);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "persist-progress", payload: { saved: 10, total: 10 } },
		});
	});

	it("returns correct structure with zero saved", () => {
		const result = buildIngestPersistProgressSystemInfo(0, 10);
		expect(result).toEqual({
			type: "data-ingest-system-info",
			data: { kind: "persist-progress", payload: { saved: 0, total: 10 } },
		});
	});
});
