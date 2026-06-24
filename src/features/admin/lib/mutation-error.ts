export async function formatMutationError(error: unknown): Promise<string> {
	if (error instanceof Response) {
		const text = await error.text();
		try {
			const json = JSON.parse(text);
			// Zod validation error array — extract human-readable messages
			if (Array.isArray(json)) {
				return json
					.map((e) => e.message ?? `${e.path?.join(".")}: ${e.code}`)
					.join("; ");
			}
			// Generic error object or plain text
			if (typeof json === "object" && json !== null && "message" in json) {
				return String(json.message);
			}
		} catch {
			// Not JSON — return raw text
		}
		return text || `Erro ${error.status}`;
	}
	if (error instanceof Error) return error.message;
	return "Ocorreu um erro inesperado";
}
