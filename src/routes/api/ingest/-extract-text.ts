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
    Return ONLY a valid JSON object with this exact structure:
    {
      "questions": [
        {
          "question": "the question text",
          "options": ["option a", "option b", "option c", "option d"],
          "answer": "the correct answer text",
          "explanation": "",
          "topic": "subject/topic name"
        }
      ],
      "topics": ["list", "of", "unique", "topics"]
    }

    Text to extract from:
    ${text}
  `;
}
