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

function isNumberedQuestionLine(line: string): boolean {
	return /^\s*(?:\*{0,2})?\d+[.):-]\s+\S/.test(line);
}

function countDistinctNumberedQuestions(lines: string[]): number | undefined {
	const numbers = new Set<number>();
	for (const line of lines) {
		const match = line.match(/^\s*(?:\*{0,2})?(\d+)[.):-]\s+\S/);
		if (match) numbers.add(Number(match[1]));
	}
	return numbers.size > 0 ? numbers.size : undefined;
}

function countGabaritoEntries(text: string): number | undefined {
	const gabaritoIndex = text.search(/(?:^|\n)#+\s*Gabarito\b/i);
	if (gabaritoIndex === -1) return undefined;

	const section = text.slice(gabaritoIndex);
	const keys = section.match(/\b\d+\s*[-–]\s*[A-E]\b/g);
	if (!keys || keys.length === 0) return undefined;

	const numbers = new Set(
		keys.map((key) => Number(key.match(/\d+/)?.[0])).filter(Number.isFinite),
	);
	return numbers.size > 0 ? numbers.size : undefined;
}

/** Best-effort count of distinct numbered questions in source text. */
export function estimateSourceQuestionCount(text: string): number | undefined {
	const trimmed = text.trim();
	if (!trimmed) return undefined;

	const fromStems = countDistinctNumberedQuestions(
		trimmed.split("\n").filter(isNumberedQuestionLine),
	);
	if (fromStems != null) return fromStems;

	const fromGabarito = countGabaritoEntries(trimmed);
	if (fromGabarito != null) return fromGabarito;

	// Do not count paragraph blocks — headers and gabarito sections inflate the count.
	const blocks = trimmed.split(/\n\s*\n/).filter((block) => block.trim());
	if (blocks.length === 1) return 1;

	return undefined;
}

export function buildExtractionUserPrompt(
	text: string,
	source?: {
		fileName: string;
		examName: string;
		expectedQuestionCount?: number;
	},
): string {
	return [
		"Extract all exam questions from the following text.",
		"For each question you find, call add_extracted_question once with the best available question text, options, answers (array of full correct option texts), and topic.",
		"If you need to correct an earlier question, call update_extracted_question using its questionId.",
		"If the source text does not contain any valid question, finish without inventing one.",
		...(source?.expectedQuestionCount != null
			? [
					`The source appears to contain about ${source.expectedQuestionCount} numbered question${source.expectedQuestionCount === 1 ? "" : "s"}. Register each distinct question exactly once, then stop.`,
					"If every question from the source text is already registered, stop immediately — do not re-extract them with different wording or without number prefixes.",
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
