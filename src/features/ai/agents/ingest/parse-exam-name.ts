/**
 * Derives a human-readable exam name from an uploaded file name.
 * Strips the path/extension and normalizes common separators.
 */
export function parseExamNameFromFileName(fileName: string): string {
	const trimmed = fileName.trim();
	if (!trimmed) return "Untitled exam";

	const baseName = trimmed.split(/[/\\]/).pop() ?? trimmed;
	const withoutExtension = baseName.replace(/\.[^.]+$/, "");
	const normalized = withoutExtension
		.replace(/[_\-.]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return normalized || withoutExtension.trim() || baseName.trim() || trimmed;
}
