import { getFileExtension } from "@/lib/file-validation";

/** Placeholder until upload derives the real title from the filename. */
export const INGEST_PENDING_EXAM_NAME = "Nova prova";

export function deriveExamNameFromFilename(filename: string): string {
	const base = filename.split(/[/\\]/).pop() ?? filename;
	const ext = getFileExtension(base);
	let name = ext ? base.slice(0, -ext.length) : base;
	name = name.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
	if (name.length === 0) return INGEST_PENDING_EXAM_NAME;
	return name.charAt(0).toUpperCase() + name.slice(1);
}
