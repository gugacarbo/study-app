export function extractTextFromBytes(bytes: Uint8Array): string {
	const text = new TextDecoder().decode(bytes);
	return [...text]
		.filter((char) => {
			const code = char.codePointAt(0);
			if (code === undefined) return false;
			if (code === 9 || code === 10 || code === 13) return true;
			if (code <= 31 || code === 127) return false;
			return true;
		})
		.join("")
		.trim();
}

/** Best-effort count of distinct numbered questions in source text. */
export function estimateSourceQuestionCount(text: string): number | undefined {
	const trimmed = text.trim();
	if (!trimmed) return undefined;

	const numberedLines = trimmed
		.split("\n")
		.filter((line) => /^\s*\d+[\.\):\-]\s+\S/.test(line));
	if (numberedLines.length > 0) return numberedLines.length;

	const blocks = trimmed.split(/\n\s*\n/).filter((block) => block.trim());
	if (blocks.length > 1) return blocks.length;

	return 1;
}

export function buildExtractionUserPrompt(
	text: string,
	source?: { fileName: string; examName: string; expectedQuestionCount?: number },
): string {
	return [
		"Extract all exam questions from the following text.",
		"For each question you find, call add_extracted_question once with the best available question text, options, answers (array of full correct option texts), and topic.",
		"If you need to correct an earlier question, call update_extracted_question using its questionId.",
		"If the source text does not contain any valid question, finish without inventing one.",
		...(source?.expectedQuestionCount != null
			? [
					`The source appears to contain ${source.expectedQuestionCount} question${source.expectedQuestionCount === 1 ? "" : "s"}. Register each distinct question exactly once, then stop.`,
					"Do not call add_extracted_question again after every source question is already registered.",
				]
			: []),
		...(source
			? [
					"",
					`Source file: ${source.fileName}`,
					`Exam name (derived from the file name): ${source.examName}`,
				]
			: []),
		"",
		"Text to extract from:",
		text,
	].join("\n");
}
