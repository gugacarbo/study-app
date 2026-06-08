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

export function buildExtractionUserPrompt(text: string): string {
	return `
    Extract all exam questions from the following text.
    For each question you find, call add_extracted_question with the best available question text, options, answer, and topic.
    If you need to correct an earlier question, call update_extracted_question using its questionId.
    If the source text does not contain any valid question, finish without inventing one.

    Text to extract from:
    ${text}
  `;
}
