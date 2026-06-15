import { useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	areExplainQuestionsExamViewsEqual,
	areImproveQuestionsExamViewsEqual,
	backgroundProcessStore,
	getExplainQuestionRun,
	getImproveQuestionsRun,
	getRunPreviewQuestion,
	type ImproveQuestionsRunPhase,
	parseExplainQuestionProcessId,
	parseImproveQuestionsProcessId,
	selectExplainQuestionsExamViews,
	selectImproveQuestionsExamViews,
} from "@/features/background-processes";
import { getExamDetail } from "@/server-functions/exams";
import { ExamHeader } from "./exam-header";
import { ExplanationPipelineTab } from "./explanation-pipeline-tab";
import { ExamInfoPanel } from "./exam-info-panel";
import { ImproveQuestionsBatchDialog } from "./improve-questions-batch-dialog";
import { ImproveQuestionsDialog } from "./improve-questions-dialog";
import { QuestionsCard } from "./questions-card";
import type { QuestionData } from "./exam-utils";
import { useExamDelete } from "./use-exam-delete";
import { useQuestionEditing } from "./use-question-editing";

interface ExamDetailProps {
	examId: number;
}

export function ExamDetail({ examId }: ExamDetailProps) {
	const [activeTab, setActiveTab] = useState("details");
	const [expandedQuestions, setExpandedQuestions] = useState(new Set<number>());
	const [improveQuestionsQuestion, setImproveQuestionsQuestion] =
		useState<QuestionData | null>(null);
	const [improveQuestionsOpen, setImproveQuestionsOpen] = useState(false);
	const [improveQuestionsBatchOpen, setImproveQuestionsBatchOpen] =
		useState(false);
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
			view.isStreaming ||
			view.status === "running" ||
			view.status === "queued",
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
					setActiveTab("explanations");
				}
				return;
			}

			const questionId = parseImproveQuestionsProcessId(focusedProcessId);
			if (questionId === null) return;

			const run = getImproveQuestionsRun(questionId);
			if (!run || run.examId !== examId) return;

			const question = exam.questions.find((q) => q.id === questionId);
			if (!question) return;

			setImproveQuestionsQuestion(question);
			setImproveQuestionsOpen(true);
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

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:inline-flex sm:h-8 sm:w-fit">
					<TabsTrigger value="details" className="px-3 py-2 sm:py-0.5">
						Detalhes
					</TabsTrigger>
					<TabsTrigger value="explanations" className="px-3 py-2 sm:py-0.5">
						{explanationProcessActive ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : null}
						Explicacoes
					</TabsTrigger>
				</TabsList>

				<TabsContent value="details" className="mt-3 sm:mt-4">
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
								setImproveQuestionsBatchOpen(true)
							}
							onImproveQuestions={(q) => {
								setImproveQuestionsQuestion(q);
								setImproveQuestionsOpen(true);
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
				</TabsContent>

				<TabsContent value="explanations" className="mt-3 sm:mt-4">
					<ExplanationPipelineTab examId={examId} questions={exam.questions} />
				</TabsContent>
			</Tabs>

			<ImproveQuestionsBatchDialog
				open={improveQuestionsBatchOpen}
				onOpenChange={setImproveQuestionsBatchOpen}
				examId={examId}
				questions={exam.questions}
				onOpenQuestion={(question) => {
					setImproveQuestionsQuestion(question);
					setImproveQuestionsOpen(true);
				}}
			/>

			{improveQuestionsQuestion && (
				<ImproveQuestionsDialog
					open={improveQuestionsOpen}
					onOpenChange={setImproveQuestionsOpen}
					questionId={improveQuestionsQuestion.id}
					examId={examId}
					question={improveQuestionsQuestion}
				/>
			)}
		</div>
	);
}
