import { useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	areImproveQuestionsExamViewsEqual,
	backgroundProcessStore,
	getImproveQuestionsRun,
	getRunPreviewQuestion,
	type ImproveQuestionsRunPhase,
	parseExplanationGenerationProcessId,
	parseImproveQuestionsProcessId,
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
			const focusedExplanationExamId =
				parseExplanationGenerationProcessId(focusedProcessId);
			if (focusedExplanationExamId !== null) {
				if (focusedExplanationExamId !== examId) return;

				setActiveTab("explanations");
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
		<div>
			<Link
				from="/exams/$id"
				to="/exams"
				className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to exams
			</Link>

			<ExamHeader
				exam={exam}
				confirmDelete={confirmDelete}
				setConfirmDelete={setConfirmDelete}
				deleting={deleting}
				handleDelete={handleDelete}
			/>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
				<TabsList>
					<TabsTrigger value="details">Detalhes</TabsTrigger>
					<TabsTrigger value="explanations">Explicacoes</TabsTrigger>
				</TabsList>

				<TabsContent value="details" className="mt-6">
					<div className="flex flex-col gap-4">
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

				<TabsContent value="explanations" className="mt-6">
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
