import { z } from "zod";

export function inputValidator<T extends z.ZodType>(schema: T) {
	return {
		inputValidator: (data: unknown) => schema.parse(data),
	};
}
