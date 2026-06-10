import { useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	getRunPreviewQuestion,
	improveOptionsStore,
	type ImproveOptionsRunPhase,
} from "@/features/exams/store/improve-options-store";
import { getExamDetail } from "@/server-functions/exams";
import { ExamHeader } from "./exam-header";
import { ExplanationPipelineTab } from "./explanation-pipeline-tab";
import { FileList } from "./file-list";
import { ImproveOptionsDialog } from "./improve-options-dialog";
import { QuestionsCard } from "./questions-card";
import type { QuestionData } from "./exam-utils";
import { StatsCards } from "./stats-cards";
import { TopicList } from "./topic-list";
import { TopicStatsCard } from "./topic-stats-card";
import { useExamDelete } from "./use-exam-delete";
import { useQuestionEditing } from "./use-question-editing";

interface ExamDetailProps {
	examId: number;
}

export function ExamDetail({ examId }: ExamDetailProps) {
	const [expandedQuestions, setExpandedQuestions] = useState(new Set<number>());
	const [improveOptionsQuestion, setImproveOptionsQuestion] =
		useState<QuestionData | null>(null);
	const [improveOptionsOpen, setImproveOptionsOpen] = useState(false);
	const improveOptionsRuns = useStore(
		improveOptionsStore,
		(state) => state.runs,
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

	const improveOptionsByQuestionId = useMemo(() => {
		const statusById = new Map<number, ImproveOptionsRunPhase>();
		const draftById = new Map<number, QuestionData>();

		for (const run of Object.values(improveOptionsRuns)) {
			if (run.examId !== examId) continue;
			statusById.set(run.questionId, run.phase);
			const liveQuestion = exam.questions.find((q) => q.id === run.questionId);
			if (liveQuestion) {
				draftById.set(
					run.questionId,
					getRunPreviewQuestion(run, liveQuestion),
				);
			}
		}

		return { statusById, draftById };
	}, [improveOptionsRuns, examId, exam.questions]);

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

			<Tabs defaultValue="details" className="mt-6">
				<TabsList>
					<TabsTrigger value="details">Detalhes</TabsTrigger>
					<TabsTrigger value="explanations">Explicacoes</TabsTrigger>
				</TabsList>

				<TabsContent value="details" className="mt-6">
					<div className="flex flex-col gap-6 lg:flex-row">
						<aside className="w-full shrink-0 lg:w-72">
							<div className="space-y-4 lg:sticky lg:top-20">
								<StatsCards exam={exam} stats={stats} />

								{exam.files.length > 0 && <FileList files={exam.files} />}

								{exam.topics.length > 0 && <TopicList topics={exam.topics} />}

								{stats.topicStats.length > 0 && stats.totalAttempts > 0 && (
									<TopicStatsCard
										topicStats={stats.topicStats}
										overallAccuracy={stats.overallAccuracy}
										completedAttempts={stats.completedAttempts}
										incompleteAttempts={stats.incompleteAttempts}
									/>
								)}
							</div>
						</aside>

						<div className="min-w-0 flex-1">
							<QuestionsCard
								questions={exam.questions}
								expandedQuestions={expandedQuestions}
								setExpandedQuestions={setExpandedQuestions}
								editingQuestionId={editingQuestionId}
								editForm={editForm}
								onStartEdit={startEditing}
								onImproveOptions={(q) => {
									setImproveOptionsQuestion(q);
									setImproveOptionsOpen(true);
								}}
								improveOptionsStatusByQuestionId={
									improveOptionsByQuestionId.statusById
								}
								draftOverrideByQuestionId={improveOptionsByQuestionId.draftById}
								onSave={handleSave}
								onCancel={cancelEditing}
								onFormChange={(updates) =>
									setEditForm((prev) => (prev ? { ...prev, ...updates } : prev))
								}
								saving={saving}
							/>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="explanations" className="mt-6">
					<ExplanationPipelineTab examId={examId} questions={exam.questions} />
				</TabsContent>
			</Tabs>

			{improveOptionsQuestion && (
				<ImproveOptionsDialog
					open={improveOptionsOpen}
					onOpenChange={setImproveOptionsOpen}
					questionId={improveOptionsQuestion.id}
					examId={examId}
					question={improveOptionsQuestion}
				/>
			)}
		</div>
	);
}
