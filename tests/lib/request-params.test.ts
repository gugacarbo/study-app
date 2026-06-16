import { describe, expect, it } from "vitest";
import {
	formatRequestParamForInput,
	parseRequestParamInput,
	requestParamsFromRows,
} from "#/lib/request-params";
import { coerceRequestParams } from "#/lib/validation";

describe("parseRequestParamInput", () => {
	it("parses booleans without quotes", () => {
		expect(parseRequestParamInput("true")).toBe(true);
		expect(parseRequestParamInput("false")).toBe(false);
		expect(parseRequestParamInput("TRUE")).toBe(true);
	});

	it("parses numbers without quotes", () => {
		expect(parseRequestParamInput("0.7")).toBe(0.7);
		expect(parseRequestParamInput("42")).toBe(42);
		expect(parseRequestParamInput("-3")).toBe(-3);
	});

	it("keeps plain strings", () => {
		expect(parseRequestParamInput("auto")).toBe("auto");
	});
});

describe("requestParamsFromRows", () => {
	it("builds typed params from form rows", () => {
		expect(
			requestParamsFromRows([
				{ key: "thinking", value: "true" },
				{ key: "temperature", value: "0.2" },
				{ key: "mode", value: "fast" },
			]),
		).toEqual({
			thinking: true,
			temperature: 0.2,
			mode: "fast",
		});
	});
});

describe("formatRequestParamForInput", () => {
	it("renders booleans and numbers without JSON quotes", () => {
		expect(formatRequestParamForInput(true)).toBe("true");
		expect(formatRequestParamForInput(false)).toBe("false");
		expect(formatRequestParamForInput(0.7)).toBe("0.7");
	});
});

describe("coerceRequestParams", () => {
	it("coerces legacy string values loaded from the database", () => {
		expect(
			coerceRequestParams({
				thinking: "true",
				temperature: "0.2",
				mode: "fast",
			}),
		).toEqual({
			thinking: true,
			temperature: 0.2,
			mode: "fast",
		});
	});
});
