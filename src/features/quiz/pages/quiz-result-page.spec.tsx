import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizResultPageContent } from "@/features/quiz/pages/quiz-result-page";
import type { AttemptResult } from "@/features/quiz/types/quiz";

const mockNavigate = vi.fn();
const mockUseAttemptResult = vi.fn();
const mockStartAttemptMutateAsync = vi.fn();

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock("@/features/quiz/hooks/use-attempt-result", () => ({
	useAttemptResult: (...args: unknown[]) => mockUseAttemptResult(...args),
}));

vi.mock("@/features/quiz/hooks/use-start-attempt", () => ({
	useStartAttempt: () => ({
		mutateAsync: mockStartAttemptMutateAsync,
		isPending: false,
	}),
}));

const LONG_EXPLANATION =
	"A questão pede leitura cuidadosa da coerência entre conceito, contexto e exceção. " +
	"Mesmo quando a alternativa parece plausível à primeira vista, a resposta correta " +
	"continua dependendo da combinação completa dos critérios do enunciado.";

function withNormalizedText(expected: string) {
	return (_content: string, element?: Element | null) =>
		element?.textContent?.replace(/\s+/g, " ").trim() === expected;
}

function makeResult(overrides?: Partial<AttemptResult>): AttemptResult {
	return {
		id: "attempt-1",
		examId: "exam-1",
		config: {
			order: "original",
			quantity: 3,
			topicFilter: null,
			revealMode: "after",
		},
		totalQuestions: 4,
		answeredQuestions: 3,
		correctAnswers: 2,
		scorePercent: 50,
		status: "completed",
		startedAt: "2026-06-24T12:00:00.000Z",
		questions: [
			{
				questionId: "question-1",
				question: "Qual conceito define o tema principal?",
				options: [
					{
						id: "A",
						text: "Definição canônica",
						explanation: "Resume o conceito pedido no enunciado.",
					},
					{
						id: "B",
						text: "Exemplo incompleto",
						explanation: "Parece plausível, mas deixa um critério de fora.",
					},
					{ id: "C", text: "Relação paralela" },
				],
				correctOptionIds: ["A"],
				selectedOptionIds: ["B"],
				credit: 0,
				explanation: "A alternativa A sintetiza o conceito central.",
			},
			{
				questionId: "question-2",
				question: "Qual alternativa descreve a exceção?",
				options: [
					{ id: "A", text: "Cenário padrão" },
					{ id: "B", text: "Variação irrelevante" },
					{ id: "C", text: "Exceção cobrada" },
				],
				correctOptionIds: ["C"],
				selectedOptionIds: [],
				credit: 0,
				explanation: "A alternativa C descreve a exceção do enunciado.",
			},
			{
				questionId: "question-3",
				question: "Quais opções permanecem corretas no cenário composto?",
				options: [
					{ id: "A", text: "Premissa base" },
					{ id: "B", text: "Atalho enganoso" },
					{ id: "C", text: "Condição complementar" },
				],
				correctOptionIds: ["A", "C"],
				selectedOptionIds: ["A"],
				credit: 1,
				explanation: LONG_EXPLANATION,
			},
		],
		...overrides,
	};
}

describe("QuizResultPageContent", () => {
	afterEach(() => {
		cleanup();
		mockNavigate.mockReset();
		mockUseAttemptResult.mockReset();
		mockStartAttemptMutateAsync.mockReset();
	});

	it("renders the redesigned study-session hero and keeps the summary metrics in the new hierarchy", () => {
		mockUseAttemptResult.mockReturnValue({
			data: makeResult(),
		});

		render(<QuizResultPageContent examId="exam-1" attemptId="attempt-1" />);

		expect(screen.getByText(/boletim da sess[aã]o/i)).toBeInTheDocument();
		expect(screen.getByText(/fechamento da tentativa/i)).toBeInTheDocument();
		expect(screen.getByText(/faixa de desempenho/i)).toBeInTheDocument();
		expect(screen.getByText(/aprendizado em andamento/i)).toBeInTheDocument();
		expect(
			screen.getByText(
				/a sess[aã]o mostrou progresso, mas ainda h[aá] lacunas claras para revisar/i,
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /nova tentativa/i }),
		).toBeInTheDocument();

		const acertos = screen.getByText("Acertos");
		const respondidas = screen.getByText("Respondidas");
		const total = screen.getByText("Total");

		expect(acertos.parentElement).toHaveTextContent(/acertos/i);
		expect(acertos.parentElement).toHaveTextContent("2");
		expect(respondidas.parentElement).toHaveTextContent(/respondidas/i);
		expect(respondidas.parentElement).toHaveTextContent("3");
		expect(total.parentElement).toHaveTextContent(/total/i);
		expect(total.parentElement).toHaveTextContent("4");
		expect(
			Boolean(
				acertos.compareDocumentPosition(respondidas) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			),
		).toBe(true);
		expect(
			Boolean(
				respondidas.compareDocumentPosition(total) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			),
		).toBe(true);
	});

	it("shows unanswered questions, separates the answer key from the user's answer, and renders question and option explanations", () => {
		mockUseAttemptResult.mockReturnValue({
			data: makeResult(),
		});

		render(<QuizResultPageContent examId="exam-1" attemptId="attempt-1" />);

		expect(screen.getAllByText("Não respondida")).toHaveLength(2);
		expect(
			screen.getByText(withNormalizedText("Sua resposta: —")),
		).toBeInTheDocument();
		expect(
			screen.getByText(withNormalizedText("Resposta correta: a")),
		).toBeInTheDocument();
		expect(
			screen.getByText(withNormalizedText("Sua resposta: b")),
		).toBeInTheDocument();
		expect(
			screen.getByText(withNormalizedText("Resposta correta: a, c")),
		).toBeInTheDocument();
		expect(
			screen.getByText(withNormalizedText("Sua resposta: a")),
		).toBeInTheDocument();
		expect(
			screen.getByText(/questão com múltiplas respostas corretas/i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/resume o conceito pedido no enunciado/i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/parece plausível, mas deixa um critério de fora/i),
		).toBeInTheDocument();
		expect(screen.getByText(/quest[aã]o em branco/i)).toBeInTheDocument();
		expect(screen.getByText(LONG_EXPLANATION)).toBeInTheDocument();
	});

	it("avoids hard-coded hex colors in the final result UI so the theme can adapt", () => {
		mockUseAttemptResult.mockReturnValue({
			data: makeResult(),
		});

		const { container } = render(
			<QuizResultPageContent examId="exam-1" attemptId="attempt-1" />,
		);

		expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
	});

	it("keeps the new-attempt CTA working from the final quiz page", async () => {
		mockUseAttemptResult.mockReturnValue({
			data: makeResult(),
		});
		mockStartAttemptMutateAsync.mockResolvedValue({
			id: "attempt-2",
		});

		render(<QuizResultPageContent examId="exam-1" attemptId="attempt-1" />);

		fireEvent.click(screen.getByRole("button", { name: /nova tentativa/i }));

		await waitFor(() => {
			expect(mockStartAttemptMutateAsync).toHaveBeenCalledWith({
				order: "original",
				quantity: 0,
				topicFilter: null,
				revealMode: "after",
			});
		});

		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith({
				to: "/exams/$examId/quiz/$attemptId",
				params: { examId: "exam-1", attemptId: "attempt-2" },
			});
		});
	});
});
