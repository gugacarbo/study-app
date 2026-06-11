import {
	JSONParseError,
	NoObjectGeneratedError,
	TypeValidationError,
} from "ai";
import { isRecoverableStructuredOutputError } from "./types";

export function extractStructuredOutputErrorCode(
	error: unknown,
): string | undefined {
	if (typeof error === "object" && error !== null) {
		if ("code" in error && typeof error.code === "string") {
			return error.code;
		}

		if (NoObjectGeneratedError.isInstance(error)) {
			if (JSONParseError.isInstance(error.cause)) {
				return "structured-output-parse-failed";
			}
			if (TypeValidationError.isInstance(error.cause)) {
				return "structured-output-validation-failed";
			}
		}

		if (JSONParseError.isInstance(error)) {
			return "parse-error";
		}

		if (TypeValidationError.isInstance(error)) {
			return "structured-output-validation-failed";
		}
	}

	return undefined;
}

export function isRecoverableGenerationError(error: unknown): boolean {
	const code = extractStructuredOutputErrorCode(error);
	if (isRecoverableStructuredOutputError(code)) {
		return true;
	}

	if (NoObjectGeneratedError.isInstance(error)) {
		return true;
	}

	if (JSONParseError.isInstance(error)) {
		return true;
	}

	if (TypeValidationError.isInstance(error)) {
		return true;
	}

	return false;
}
