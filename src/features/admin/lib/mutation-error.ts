export async function formatMutationError(error: unknown): Promise<string> {
	if (error instanceof Response) {
		const text = await error.text();
		return text || `Erro ${error.status}`;
	}
	if (error instanceof Error) return error.message;
	return "Ocorreu um erro inesperado";
}
