import {
	coerceRequestParamValue,
	type RequestParams,
	type RequestParamValue,
} from "@/lib/validation";

export function parseRequestParamInput(raw: string): RequestParamValue {
	const trimmed = raw.trim();
	if (trimmed === "") return "";

	if (
		trimmed.startsWith("{") ||
		trimmed.startsWith("[") ||
		trimmed.startsWith('"')
	) {
		try {
			return coerceRequestParamValue(JSON.parse(trimmed));
		} catch {
			return raw;
		}
	}

	return coerceRequestParamValue(trimmed);
}

export function formatRequestParamForInput(value: RequestParamValue): string {
	if (typeof value === "string") return value;
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null
	) {
		return String(value);
	}
	return JSON.stringify(value);
}

export function requestParamsFromRows(
	rows: Array<{ key: string; value: string }>,
): RequestParams {
	const result: RequestParams = {};
	for (const row of rows) {
		const key = row.key.trim();
		if (!key) continue;
		result[key] = parseRequestParamInput(row.value);
	}
	return result;
}
