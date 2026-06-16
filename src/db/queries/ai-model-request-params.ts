import { coerceRequestParams, requestParamsSchema, type RequestParams } from "@/lib/validation";

export function parseRequestParams(
	raw: string | null | undefined,
): RequestParams {
	if (!raw?.trim()) return {};

	try {
		const parsed: unknown = JSON.parse(raw);
		const result = requestParamsSchema.safeParse(parsed);
		return result.success ? coerceRequestParams(result.data) : {};
	} catch {
		return {};
	}
}

export function serializeRequestParams(
	params: RequestParams | null | undefined,
): string | null {
	if (!params || Object.keys(params).length === 0) return null;
	return JSON.stringify(params);
}
