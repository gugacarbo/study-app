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
				{
					label: "Como funciona?",
					message: "Explique como funciona a ingestão de PDFs neste app.",
				},
				{
					label: "Próximos passos",
					message: "O que devo fazer após concluir a ingestão?",
				},
			];
		case "memory":
			return [
				{
					label: "Resumir memória",
					message: "Resuma o conteúdo de memória disponível.",
				},
				{
					label: "O que está salvo?",
					message: "O que está armazenado na minha memória de estudos?",
				},
				{
					label: "Como usar?",
					message: "Como a memória ajuda nas minhas sessões de estudo?",
				},
			];
		default:
			return [
				{
					label: "O que posso fazer?",
					message: "O que posso fazer neste app de estudo?",
				},
				{
					label: "Como começar?",
					message: "Como posso começar a estudar com este app?",
				},
				{
					label: "Buscar questões",
					message: "Como posso buscar questões por tópico ou matéria?",
				},
			];
	}
}
