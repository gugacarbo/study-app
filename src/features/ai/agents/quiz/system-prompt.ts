export function buildQuizSystemPrompt(memoryContext?: string): string {
	if (memoryContext) {
		return `You are a helpful assistant that generates exam questions. Always return valid JSON.
Use the following context about the student's learning history to personalize questions:

${memoryContext}`;
	}
	return "You are a helpful assistant that generates exam questions. Always return valid JSON.";
}
