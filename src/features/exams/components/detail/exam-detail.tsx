import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	areExplainQuestionsExamUiEqual,
	areExplainQuestionsExamViewsEqual,
	areImproveQuestionsExamUiEqual,
	areImproveQuestionsExamViewsEqual,
	backgroundProcessStore,
	getExplainQuestionRun,
	getImproveQuestionsRun,
	getRunPreviewQuestion,
	type ImproveQuestionsRunPhase,
	parseExplainQuestionProcessId,
	parseImproveQuestionsProcessId,
	selectExplainQuestionsExamUi,
	selectExplainQuestionsExamViews,
	selectImproveQuestionsExamUi,
	selectImproveQuestionsExamViews,
	setExplainQuestionsBatchDialogOpen,
	setExplainQuestionsQuestionDialogOpen,
	setImproveQuestionsBatchDialogOpen,
	setImproveQuestionsQuestionDialogOpen,
} from "@/features/background-processes";
import { getExamDetail } from "@/server-functions/exams";
import { ExamHeader } from "./exam-header";
import { ExamInfoPanel } from "./exam-info-panel";
import type { QuestionData } from "./exam-utils";
import { ExplainQuestionsBatchDialog } from "./explain-questions-batch-dialog";
import { ExplainQuestionsDialogContainer } from "./explain-questions-dialog";
import { ImproveQuestionsBatchDialog } from "./improve-questions-batch-dialog";
import { ImproveQuestionsDialog } from "./improve-questions-dialog";
import { QuestionsCard } from "./questions-card";
import { useExamDelete } from "./use-exam-delete";
import { useQuestionEditing } from "./use-question-editing";

interface ExamDetailProps {
	examId: number;
}

export function ExamDetail({ examId }: ExamDetailProps) {
	const [expandedQuestions, setExpandedQuestions] = useState(new Set<number>());
	const improveQuestionsUi = useStore(
		backgroundProcessStore,
		(state) => selectImproveQuestionsExamUi(state, examId),
		areImproveQuestionsExamUiEqual,
	);
	const explainQuestionsUi = useStore(
		backgroundProcessStore,
		(state) => selectExplainQuestionsExamUi(state, examId),
		areExplainQuestionsExamUiEqual,
	);
	const improveQuestionsBatchOpen = improveQuestionsUi.batchDialogOpen;
	const explainQuestionsBatchOpen = explainQuestionsUi.batchDialogOpen;
	const explainQuestionsOpen =
		explainQuestionsUi.questionDialogQuestionId !== null;
	const improveQuestionsOpen =
		improveQuestionsUi.questionDialogQuestionId !== null;
	const improveQuestionsExamViews = useStore(
		backgroundProcessStore,
		(state) => selectImproveQuestionsExamViews(state, examId),
		areImproveQuestionsExamViewsEqual,
	);
	const focusedProcessId = useStore(
		backgroundProcessStore,
		(state) => state.focusedProcessId,
	);
	const explainQuestionsExamViews = useStore(
		backgroundProcessStore,
		(state) => selectExplainQuestionsExamViews(state, examId),
		areExplainQuestionsExamViewsEqual,
	);
	const explanationProcessActive = explainQuestionsExamViews.some(
		(view) =>
			view.isStreaming || view.status === "running" || view.status === "queued",
	);

	const { data: exam } = useSuspenseQuery({
		queryKey: ["exam-detail", examId],
		queryFn: () => getExamDetail({ data: { id: examId } }),
	});

	const { deleting, confirmDelete, setConfirmDelete, handleDelete } =
		useExamDelete({ examId });

	const {
		editingQuestionId,
		editForm,
		saving,
		startEditing,
		cancelEditing,
		handleSave,
		setEditForm,
	} = useQuestionEditing({ examId });

	const { stats } = exam;

	const improveQuestionsQuestion = useMemo(() => {
		const questionId = improveQuestionsUi.questionDialogQuestionId;
		if (questionId === null) return null;
		return (
			exam.questions.find((question) => question.id === questionId) ?? null
		);
	}, [exam.questions, improveQuestionsUi.questionDialogQuestionId]);

	const explainQuestionsQuestion = useMemo(() => {
		const questionId = explainQuestionsUi.questionDialogQuestionId;
		if (questionId === null) return null;
		return (
			exam.questions.find((question) => question.id === questionId) ?? null
		);
	}, [exam.questions, explainQuestionsUi.questionDialogQuestionId]);

	const improveQuestionsByQuestionId = useMemo(() => {
		const statusById = new Map<number, ImproveQuestionsRunPhase>();
		const draftById = new Map<number, QuestionData>();

		for (const view of improveQuestionsExamViews) {
			statusById.set(view.questionId, view.phase);
			const liveQuestion = exam.questions.find((q) => q.id === view.questionId);
			if (liveQuestion) {
				draftById.set(
					view.questionId,
					getRunPreviewQuestion(view, liveQuestion),
				);
			}
		}

		return { statusById, draftById };
	}, [improveQuestionsExamViews, exam.questions]);

	useEffect(() => {
		if (!focusedProcessId) return;

		const clearFocus = () => {
			backgroundProcessStore.setState((state) => ({
				...state,
				focusedProcessId: null,
			}));
		};

		try {
			const explainQuestionId = parseExplainQuestionProcessId(focusedProcessId);
			if (explainQuestionId !== null) {
				const run = getExplainQuestionRun(explainQuestionId);
				if (run?.examId === examId) {
					setExplainQuestionsQuestionDialogOpen(examId, explainQuestionId);
				}
				return;
			}

			const questionId = parseImproveQuestionsProcessId(focusedProcessId);
			if (questionId === null) return;

			const run = getImproveQuestionsRun(questionId);
			if (!run || run.examId !== examId) return;

			const question = exam.questions.find((q) => q.id === questionId);
			if (!question) return;

			setImproveQuestionsQuestionDialogOpen(examId, questionId);
		} finally {
			clearFocus();
		}
	}, [focusedProcessId, examId, exam.questions]);

	return (
		<div className="flex flex-col gap-3 pb-4 sm:gap-4 sm:pb-5">
			<Link
				from="/exams/$id"
				to="/exams"
				className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft className="size-4 shrink-0" />
				Back to exams
			</Link>

			<ExamHeader
				exam={exam}
				confirmDelete={confirmDelete}
				setConfirmDelete={setConfirmDelete}
				deleting={deleting}
				handleDelete={handleDelete}
			/>

			<div className="flex flex-col gap-3 sm:gap-4">
				<ExamInfoPanel exam={exam} stats={stats} />

				<QuestionsCard
					questions={exam.questions}
					expandedQuestions={expandedQuestions}
					setExpandedQuestions={setExpandedQuestions}
					editingQuestionId={editingQuestionId}
					editForm={editForm}
					onStartEdit={startEditing}
					onOpenImproveQuestionsBatch={() =>
						setImproveQuestionsBatchDialogOpen(examId, true)
					}
					onOpenExplainQuestionsBatch={() =>
						setExplainQuestionsBatchDialogOpen(examId, true)
					}
					explanationProcessActive={explanationProcessActive}
					onImproveQuestions={(q) => {
						setImproveQuestionsQuestionDialogOpen(examId, q.id);
					}}
					improveQuestionsStatusByQuestionId={
						improveQuestionsByQuestionId.statusById
					}
					draftOverrideByQuestionId={improveQuestionsByQuestionId.draftById}
					onSave={handleSave}
					onCancel={cancelEditing}
					onFormChange={(updates) =>
						setEditForm((prev) => (prev ? { ...prev, ...updates } : prev))
					}
					saving={saving}
				/>
			</div>

			<ExplainQuestionsBatchDialog
				open={explainQuestionsBatchOpen}
				onOpenChange={(open) =>
					setExplainQuestionsBatchDialogOpen(examId, open)
				}
				examId={examId}
				questions={exam.questions}
				onOpenQuestion={(question) => {
					setExplainQuestionsQuestionDialogOpen(examId, question.id);
				}}
			/>

			<ImproveQuestionsBatchDialog
				open={improveQuestionsBatchOpen}
				onOpenChange={(open) =>
					setImproveQuestionsBatchDialogOpen(examId, open)
				}
				examId={examId}
				questions={exam.questions}
				onOpenQuestion={(question) => {
					setImproveQuestionsQuestionDialogOpen(examId, question.id);
				}}
			/>

			{explainQuestionsQuestion && (
				<ExplainQuestionsDialogContainer
					open={explainQuestionsOpen}
					onOpenChange={(open) => {
						if (!open) {
							setExplainQuestionsQuestionDialogOpen(examId, null);
						}
					}}
					questionId={explainQuestionsQuestion.id}
					examId={examId}
					question={explainQuestionsQuestion}
				/>
			)}

			{improveQuestionsQuestion && (
				<ImproveQuestionsDialog
					open={improveQuestionsOpen}
					onOpenChange={(open) => {
						if (!open) {
							setImproveQuestionsQuestionDialogOpen(examId, null);
						}
					}}
					questionId={improveQuestionsQuestion.id}
					examId={examId}
					question={improveQuestionsQuestion}
				/>
			)}
		</div>
	);
}
