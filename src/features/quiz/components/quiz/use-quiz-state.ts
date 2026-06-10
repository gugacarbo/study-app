import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	nextQuestion,
	quizStore,
	recordAnswer,
	selectAnswer,
	startQuiz,
	toggleAnswer,
} from "@/features/quiz/store/quiz-store";
import type { ProviderConfig } from "@/lib/validation";
import { getConfig } from "@/server-functions/config";
import {
	abandonQuizAttempts,
	generateQuiz,
	listQuizAttempts,
	submitAnswer,
} from "@/server-functions/quiz";
import type { QA } from "../use-quiz-persistence";

interface UseQuizStateProps {
	examId?: number;
	topic?: string;
}

function formatUserAnswer(userAnswers: string[]): string {
	return userAnswers.length === 1 ? userAnswers[0] : userAnswers.join("; ");
}

export function useQuizState({ examId, topic }: UseQuizStateProps) {
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

	const { data: attempts } = useQuery({
		queryKey: ["quiz-attempts", examId, topic],
		queryFn: () => listQuizAttempts({ data: { examId, topic, pageSize: 5 } }),
		enabled: examId !== undefined || topic !== undefined,
	});

	const restartAttempt = useMutation({
		mutationFn: () => abandonQuizAttempts({ data: { examId, topic } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["quiz-attempts", examId, topic] });
			qc.invalidateQueries({ queryKey: ["stats"] });
		},
	});

	const mut = useMutation({
		mutationFn: (v: {
			attemptId?: number | null;
			examId?: number;
			totalQuestions: number;
			questionId: number;
			userAnswers: string[];
			correctAnswers: string[];
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
					userAnswers: v.userAnswers,
				},
			}),
		onSuccess: (data, v) => {
			setAttemptId(data.attemptId);
			ans.current.push({
				question: v.question,
				userAnswer: formatUserAnswer(v.userAnswers),
				correctAnswers: data.correctAnswers,
				isCorrect: data.correct,
				credit: data.credit,
				explanation: data.explanation,
				longExplanation: data.longExplanation || "",
				topic: v.topic || "General",
			});
			recordAnswer(data.credit, data.correct, data.explanation);
			setLongExp(data.longExplanation || "");
			qc.invalidateQueries({ queryKey: ["stats"] });
			qc.invalidateQueries({ queryKey: ["quiz-attempts", examId, topic] });
		},
		onError: (err) => {
			console.error("Failed to submit:", err);
		},
	});

	useEffect(() => {
		getConfig().then(setConfig);
	}, []);

	useEffect(() => {
		attemptIdRef.current = attemptId;
	});

	return {
		config,
		questions,
		attempts: attempts || [],
		restartAttempt: restartAttempt.mutateAsync,
		mut,
		longExp,
		ans,
		attemptId,
		setAttemptId,
		attemptIdRef,
	};
}

export { nextQuestion, quizStore, selectAnswer, startQuiz, toggleAnswer };
