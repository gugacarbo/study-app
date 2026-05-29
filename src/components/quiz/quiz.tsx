import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { generateQuiz, submitAnswer } from "../../server-functions/quiz";
import { getConfig } from "../../server-functions/config";
import { saveQuizSessionToMemory } from "../../server-functions/memory";
import {
	quizStore,
	resetQuiz,
	selectAnswer,
	nextQuestion,
	recordAnswer,
	hydrateQuiz,
} from "../../stores/quizStore";
import { QuizQuestion, type QuestionWithId } from "./quiz-question";
import { QuizResults } from "./quiz-results";
import { QuizExplanation } from "./quiz-explanation";
import type { ProviderConfig } from "../../lib/validation";
import { Card, CardContent } from "@/components/ui/card";

type QA = {
	question: string;
	userAnswer: string;
	correctAnswer: string;
	isCorrect: boolean;
	explanation: string;
	topic: string;
};

export function Quiz({ examId, topic }: { examId?: number; topic?: string }) {
	const qc = useQueryClient();
	const [config, setConfig] = useState<ProviderConfig | null>(null);
	const [init, setInit] = useState(false);
	const [longExp, setLongExp] = useState("");
	const ans = useRef<QA[]>([]);
	const sk = `study-app:quiz:${examId ?? "topic"}:${topic ?? "general"}`;
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
			questionId: number;
			userAnswer: string;
			correctAnswer: string;
			question: string;
			topic?: string;
		}) =>
			submitAnswer({
				data: { questionId: v.questionId, userAnswer: v.userAnswer },
			}),
		onSuccess: (data, v) => {
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
	const st = useStore(quizStore, (s) => s);
	const qr = useRef(questions);
	const sr = useRef(st);
	const mr = useRef(mut);
	useEffect(() => {
		qr.current = questions;
		sr.current = st;
		mr.current = mut;
	});

	useEffect(() => {
		if (!questions?.length || init) return;
		const fb = () => {
			resetQuiz(questions.length);
			ans.current = [];
			setInit(true);
		};
		try {
			const r = localStorage.getItem(sk);
			if (!r) {
				fb();
				return;
			}
			const p = JSON.parse(r);
			if (
				!p?.quizState ||
				p.quizState.total !== questions.length ||
				p.quizState.currentQuestionIndex < 0 ||
				p.quizState.currentQuestionIndex > questions.length
			) {
				fb();
				return;
			}
			hydrateQuiz(p.quizState);
			ans.current = Array.isArray(p.answers) ? p.answers : [];
			setInit(true);
		} catch {
			fb();
		}
	}, [questions, init, sk]);

	useEffect(() => {
		if (!init) return;
		const sub = quizStore.subscribe(() => {
			const s = quizStore.state;
			localStorage.setItem(
				sk,
				JSON.stringify({ quizState: s, answers: ans.current }),
			);
			if (
				s.isComplete &&
				s.currentQuestionIndex >= s.total &&
				ans.current.length > 0
			) {
				saveQuizSessionToMemory({
					data: {
						examName: examId ? `Exam #${examId}` : topic || "General",
						topic: topic || "General",
						totalQuestions: s.total,
						correctAnswers: s.score,
						questions: ans.current,
					},
				}).catch(() => {});
				localStorage.removeItem(sk);
			}
		});
		return () => sub.unsubscribe();
	}, [init, sk, examId, topic]);

	const hk = useCallback((e: KeyboardEvent) => {
		const qs = qr.current;
		const state = sr.current;
		const m = mr.current;
		if (!qs?.[state.currentQuestionIndex]) return;
		const q = qs[state.currentQuestionIndex] as QuestionWithId;
		const num = Number(e.key) - 1;
		if (num >= 0 && num < 4 && q.options[num]) selectAnswer(q.options[num]);
		if (e.key === "Enter") {
			if (m.isPending) return;
			if (state.selectedAnswer && !state.showExplanation)
				m.mutate({
					questionId: q.id,
					userAnswer: state.selectedAnswer,
					correctAnswer: q.answer,
					question: q.question,
					topic: q.topic,
				});
			else if (state.showExplanation) nextQuestion();
		}
	}, []);

	useEffect(() => {
		window.addEventListener("keydown", hk);
		return () => window.removeEventListener("keydown", hk);
	}, [hk]);

	if (!config || !init || !questions) return <div>Loading...</div>;
	if (st.isComplete)
		return (
			<QuizResults score={st.score} total={st.total} answers={ans.current} />
		);
	const cq = questions[st.currentQuestionIndex] as QuestionWithId;
	if (!cq) return <div>Loading...</div>;

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
								questionId: cq.id,
								userAnswer: st.selectedAnswer,
								correctAnswer: cq.answer,
								question: cq.question,
								topic: cq.topic,
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
