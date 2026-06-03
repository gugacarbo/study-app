import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ProviderConfig } from "../../lib/validation";
import { getConfig } from "../../server-functions/config";
import { generateQuiz, submitAnswer } from "../../server-functions/quiz";
import {
	nextQuestion,
	quizStore,
	recordAnswer,
	selectAnswer,
} from "../../stores/quizStore";
import { QuizExplanation } from "./quiz-explanation";
import { QuizLoading } from "./quiz-loading";
import { type QuestionWithId, QuizQuestion } from "./quiz-question";
import { QuizResults } from "./quiz-results";
import { useQuizKeyboard } from "./use-quiz-keyboard";
import { type QA, useQuizPersistence } from "./use-quiz-persistence";

export function Quiz({ examId, topic }: { examId?: number; topic?: string }) {
	const qc = useQueryClient();
	const [config, setConfig] = useState<ProviderConfig | null>(null);
	const [longExp, setLongExp] = useState("");
	const [attemptId, setAttemptId] = useState<number | null>(null);
	const ans = useRef<QA[]>([]);
	const attemptIdRef = useRef<number | null>(null);

	const { data: questions } = useQuery({
		queryKey: ["quiz", examId, topic],
		queryFn: () => {
			if (!config) throw new Error("Config not loaded");
			return generateQuiz({ data: { examId, topic, count: 10, config } });
		},
		enabled: !!config,
	});

	const mut = useMutation({
		mutationFn: (v: {
			attemptId?: number | null;
			examId?: number;
			totalQuestions: number;
			questionId: number;
			userAnswer: string;
			correctAnswer: string;
			question: string;
			topic?: string;
		}) =>
			submitAnswer({
				data: {
					attemptId: v.attemptId ?? undefined,
					examId: v.examId,
					topic: v.topic,
					totalQuestions: v.totalQuestions,
					questionId: v.questionId,
					userAnswer: v.userAnswer,
				},
			}),
		onSuccess: (data, v) => {
			setAttemptId(data.attemptId);
			ans.current.push({
				question: v.question,
				userAnswer: v.userAnswer,
				correctAnswer: v.correctAnswer,
				isCorrect: data.correct,
				explanation: data.explanation,
				topic: v.topic || "General",
			});
			recordAnswer(data.correct, data.explanation);
			setLongExp(data.longExplanation || "");
			qc.invalidateQueries({ queryKey: ["stats"] });
		},
		onError: (err) => {
			console.error("Failed to submit:", err);
		},
	});

	useEffect(() => {
		getConfig().then(setConfig);
	}, []);

	const st = useSelector(quizStore, (s) => s);
	const qr = useRef(questions);
	const sr = useRef(st);
	const mr = useRef(mut);

	useEffect(() => {
		qr.current = questions;
		sr.current = st;
		mr.current = mut;
		attemptIdRef.current = attemptId;
	});

	const { init } = useQuizPersistence({
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

	if (!config || !init || !questions) return <QuizLoading withButton />;

	if (st.isComplete)
		return (
			<QuizResults score={st.score} total={st.total} answers={ans.current} />
		);

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
					selectedAnswer={st.selectedAnswer}
					showExplanation={st.showExplanation}
					isPending={mut.isPending}
					onSubmit={() => {
						if (st.selectedAnswer)
							mut.mutate({
								attemptId,
								examId,
								totalQuestions: st.total,
								questionId: cq.id,
								userAnswer: st.selectedAnswer,
								correctAnswer: cq.answer,
								question: cq.question,
								topic,
							});
					}}
					onSelectAnswer={selectAnswer}
					submitError={mut.isError ? mut.error.message : null}
				/>
				{st.showExplanation && (
					<QuizExplanation
						isCorrect={st.isCorrect ?? false}
						explanation={st.explanation}
						longExplanation={longExp}
						onNext={nextQuestion}
					/>
				)}
			</CardContent>
		</Card>
	);
}
