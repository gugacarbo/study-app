export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = { [key: string]: JsonValue };

export function parseJsonObject(raw: string | null): JsonObject | null {
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as JsonObject;
		}
		return null;
	} catch {
		return null;
	}
}
