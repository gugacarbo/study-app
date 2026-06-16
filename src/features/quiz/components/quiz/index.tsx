import { useSelector } from "@tanstack/react-store";
import { useEffect, useMemo, useRef } from "react";
import { useRegisterPageChatContext } from "@/features/ai/context/page-chat-context";
import type {
	ClientToolDefinition,
	PageChatContextRegistration,
} from "@/features/ai/context/page-chat-registry";
import { Card, CardContent } from "@/components/ui/card";
import { QuizExplanation } from "../quiz-explanation";
import { QuizLoading } from "../quiz-loading";
import { type QuestionWithId, QuizQuestion } from "../quiz-question";
import { QuizResults } from "../quiz-results";
import { QuizStart } from "../quiz-start";
import { useQuizKeyboard } from "../use-quiz-keyboard";
import { useQuizPersistence } from "../use-quiz-persistence";
import {
	nextQuestion,
	quizStore,
	selectAnswer,
	startQuiz,
	toggleAnswer,
	useQuizState,
} from "./use-quiz-state";

export function Quiz({ examId, topic }: { examId?: number; topic?: string }) {
	const {
		questions,
		attempts,
		restartAttempt,
		mut,
		longExp,
		ans,
		attemptId,
		setAttemptId,
		attemptIdRef,
	} = useQuizState({ examId, topic });

	const st = useSelector(quizStore, (s) => s);
	const qr = useRef(questions);
	const sr = useRef(st);
	const mr = useRef(mut);

	useEffect(() => {
		qr.current = questions;
		sr.current = st;
		mr.current = mut;
	});

	const { init, restartQuiz } = useQuizPersistence({
		examId,
		topic,
		questions,
		answersRef: ans,
		attemptId,
		setAttemptId,
	});
	useQuizKeyboard({
		questionsRef: qr,
		stateRef: sr,
		mutationRef: mr,
		attemptIdRef,
		examId,
		topic,
	});

	const currentQuestion = st.hasStarted
		? (questions?.[st.currentQuestionIndex] as QuestionWithId | undefined)
		: undefined;

	useRegisterPageChatContext(
		useMemo((): PageChatContextRegistration => {
			const clientTools: ClientToolDefinition[] = [
				{
					name: "reveal_hint",
					description: "Revela uma dica sobre a questão atual do quiz.",
					parameters: { type: "object", properties: {} },
				},
				{
					name: "go_to_question",
					description:
						"Navega para uma questão específica do quiz (índice 1-based).",
					parameters: {
						type: "object",
						properties: {
							index: { type: "number" },
						},
						required: ["index"],
					},
				},
			];

			return {
				summary:
					st.hasStarted && currentQuestion
						? `Questão ${st.currentQuestionIndex + 1}/${st.total}. Score: ${st.score}/${st.total}. ${currentQuestion.question.slice(0, 160)}`
						: `Quiz com ${questions?.length ?? 0} questões`,
				examId: examId !== undefined ? String(examId) : undefined,
				questionId: currentQuestion ? String(currentQuestion.id) : undefined,
				clientTools,
			};
		}, [
				st.hasStarted,
				st.currentQuestionIndex,
				st.total,
				st.score,
				currentQuestion,
				questions?.length,
				examId,
			],
		),
	);

	if (!init || !questions) return <QuizLoading withButton />;

	if (st.isComplete)
		return (
			<QuizResults score={st.score} total={st.total} answers={ans.current} />
		);

	if (!st.hasStarted) {
		return (
			<QuizStart
				total={questions.length}
				onStart={startQuiz}
				onRestart={async () => {
					await restartAttempt();
					restartQuiz();
					startQuiz();
				}}
				hasSavedProgress={st.hasSavedProgress}
				attempts={attempts}
			/>
		);
	}

	const cq = questions[st.currentQuestionIndex] as QuestionWithId;
	if (!cq) return <QuizLoading />;

	return (
		<Card>
			<CardContent>
				<QuizQuestion
					question={cq}
					currentIndex={st.currentQuestionIndex}
					total={st.total}
					score={st.score}
					selectedAnswers={st.selectedAnswers}
					showExplanation={st.showExplanation}
					isPending={mut.isPending}
					onSubmit={() => {
						if (st.selectedAnswers.length === 0) return;
						mut.mutate({
							attemptId,
							examId,
							totalQuestions: st.total,
							questionId: cq.id,
							userAnswers: st.selectedAnswers,
							correctAnswers: cq.answers,
							question: cq.question,
							topic,
						});
					}}
					onSelectAnswer={selectAnswer}
					onToggleAnswer={toggleAnswer}
					submitError={mut.isError ? mut.error.message : null}
				/>
				{st.showExplanation && (
					<QuizExplanation
						isCorrect={st.isCorrect ?? false}
						credit={ans.current.at(-1)?.credit}
						explanation={st.explanation}
						longExplanation={longExp}
						onNext={nextQuestion}
					/>
				)}
			</CardContent>
		</Card>
	);
}
