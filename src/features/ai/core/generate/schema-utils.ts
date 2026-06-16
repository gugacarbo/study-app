import { asSchema, type FlexibleSchema } from "ai";
import type { z } from "zod";
import type { OutputSchema } from "./types";

export function toFlexibleSchema<T>(
	schema: OutputSchema<T>,
): FlexibleSchema<T> {
	return asSchema(schema);
}

export function resolveObjectGenerationOptions<T>(schema: OutputSchema<T>): {
	schema: FlexibleSchema<unknown>;
	output?: "object" | "array";
} {
	const arraySchema = schema as OutputSchema<unknown>;
	if (isZodArray(arraySchema)) {
		return {
			schema: asSchema(arraySchema.element),
			output: "array",
		};
	}

	return {
		schema: asSchema(schema),
		output: "object",
	};
}

function isZodArray(
	schema: OutputSchema<unknown>,
): schema is z.ZodArray<z.ZodType> {
	return (
		typeof schema === "object" &&
		schema !== null &&
		"element" in schema &&
		typeof (schema as { element?: unknown }).element === "object" &&
		(schema as { element: object }).element !== null
	);
}
