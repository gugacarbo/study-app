export interface PageChatSuggestion {
	label: string;
	message: string;
}

export function getPageChatSuggestions(pageType: string): PageChatSuggestion[] {
	switch (pageType) {
		case "exam":
			return [
				{
					label: "Resuma este exame",
					message: "Resuma as questões e tópicos principais deste exame.",
				},
				{
					label: "Questões difíceis",
					message: "Quais são as questões mais difíceis deste exame?",
				},
				{
					label: "Sugerir estudo",
					message: "Como devo estudar para este exame?",
				},
			];
		case "quiz":
			return [
				{
					label: "Explique a resposta",
					message: "Explique por que a resposta correta está certa.",
				},
				{
					label: "Dica de estudo",
					message: "Dê uma dica para lembrar o conceito desta questão.",
				},
				{
					label: "Meu progresso",
					message: "Como está meu progresso neste quiz?",
				},
			];
		case "ingest":
			return [
				{
					label: "Status da ingestão",
					message: "Qual o status atual da ingestão de PDFs?",
				},
			];
		case "memory":
			return [
				{
					label: "Resumir memória",
					message: "Resuma o conteúdo de memória disponível.",
				},
			];
		default:
			return [
				{
					label: "O que posso fazer?",
					message: "O que posso fazer neste app de estudo?",
				},
			];
	}
}
