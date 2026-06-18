import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

describe("schema", () => {
	it("defines core auth and domain tables", () => {
		expect(schema.user).toBeDefined();
		expect(schema.exams).toBeDefined();
		expect(schema.files).toBeDefined();
		expect(schema.llmLogs).toBeDefined();
		expect(schema.r2OperationLogs).toBeDefined();
		expect(schema.backgroundJobs).toBeDefined();
	});

	it("uses text UUID primary keys for domain tables", () => {
		expect(schema.exams.id.dataType).toBe("string");
		expect(schema.files.id.dataType).toBe("string");
		expect(schema.questions.id.dataType).toBe("string");
	});
});
