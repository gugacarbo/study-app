import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	nextQuestion,
	quizStore,
	recordAnswer,
	selectAnswer,
} from "@/features/quiz/store/quiz-store";
import type { ProviderConfig } from "@/lib/validation";
import { getConfig } from "@/server-functions/config";
import { generateQuiz, submitAnswer } from "@/server-functions/quiz";
import type { QA } from "../use-quiz-persistence";

interface UseQuizStateProps {
	examId?: number;
	topic?: string;
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

	useEffect(() => {
		attemptIdRef.current = attemptId;
	});

	return {
		config,
		questions,
		mut,
		longExp,
		ans,
		attemptId,
		setAttemptId,
		attemptIdRef,
	};
}

export { nextQuestion, quizStore, selectAnswer };
