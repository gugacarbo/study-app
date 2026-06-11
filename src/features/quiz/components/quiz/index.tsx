import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
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
