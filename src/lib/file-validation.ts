import { JOB_ERROR_CODE } from "@/lib/job-errors";

export const ALLOWED_FILE_EXTENSIONS = new Set([".txt", ".md"]);

export function getFileExtension(filename: string): string {
	const dot = filename.lastIndexOf(".");
	if (dot < 0) return "";
	return filename.slice(dot).toLowerCase();
}

export function isAllowedFileExtension(filename: string): boolean {
	return ALLOWED_FILE_EXTENSIONS.has(getFileExtension(filename));
}

export type FileExtensionValidationResult =
	| { ok: true }
	| { ok: false; error: typeof JOB_ERROR_CODE.INVALID_FILE_TYPE };

export function validateFileExtension(
	filename: string,
): FileExtensionValidationResult {
	if (isAllowedFileExtension(filename)) {
		return { ok: true };
	}
	return { ok: false, error: JOB_ERROR_CODE.INVALID_FILE_TYPE };
}
