import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { getExamDetail } from "../../server-functions/exams";
import { ExamHeader } from "./exam-header";
import { FileList } from "./file-list";
import { QuestionsCard } from "./questions-card";
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
	const [explanationsDialogOpen, setExplanationsDialogOpen] = useState(false);

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

	const toggleQuestion = (id: number) => {
		setExpandedQuestions((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const { stats } = exam;

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
				explanationsDialogOpen={explanationsDialogOpen}
				setExplanationsDialogOpen={setExplanationsDialogOpen}
				examId={examId}
			/>

			<StatsCards exam={exam} stats={stats} />

			{exam.files.length > 0 && <FileList files={exam.files} />}

			{exam.topics.length > 0 && <TopicList topics={exam.topics} />}

			{stats.topicStats.length > 0 && stats.totalAttempts > 0 && (
				<TopicStatsCard
					topicStats={stats.topicStats}
					overallAccuracy={stats.overallAccuracy}
					totalAttempts={stats.totalAttempts}
					correctAttempts={stats.correctAttempts}
				/>
			)}

			<QuestionsCard
				questions={exam.questions}
				expandedQuestions={expandedQuestions}
				setExpandedQuestions={setExpandedQuestions}
				editingQuestionId={editingQuestionId}
				editForm={editForm}
				onStartEdit={startEditing}
				onSave={handleSave}
				onCancel={cancelEditing}
				onFormChange={(updates) =>
					setEditForm((prev) => (prev ? { ...prev, ...updates } : prev))
				}
				saving={saving}
				toggleQuestion={toggleQuestion}
			/>
		</div>
	);
}
