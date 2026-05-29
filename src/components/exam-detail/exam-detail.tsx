import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
	getExamDetail,
	deleteExam,
	updateQuestion,
} from "../../server-functions/exams";
import { StatsCards } from "./stats-cards";
import { FileList } from "./file-list";
import { TopicList } from "./topic-list";
import { TopicStatsCard } from "./topic-stats-card";
import { QuestionsCard } from "./questions-card";
import { ExamHeader } from "./exam-header";
import type { EditFormData } from "./exam-utils";
interface ExamDetailProps {
	examId: number;
}

export function ExamDetail({ examId }: ExamDetailProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [deleting, setDeleting] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [expandedQuestions, setExpandedQuestions] = useState(new Set<number>());
	const [editingQuestionId, setEditingQuestionId] = useState<number | null>(
		null,
	);
	const [editForm, setEditForm] = useState<EditFormData | null>(null);
	const [saving, setSaving] = useState(false);
	const [explanationsDialogOpen, setExplanationsDialogOpen] = useState(false);

	const { data: exam } = useSuspenseQuery({
		queryKey: ["exam-detail", examId],
		queryFn: () => getExamDetail({ data: { id: examId } }),
	});

	const toggleQuestion = (id: number) => {
		setExpandedQuestions((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleDelete = async () => {
		setDeleting(true);
		try {
			await deleteExam({ data: { id: examId } });
			queryClient.invalidateQueries({ queryKey: ["exams-detailed"] });
			queryClient.invalidateQueries({ queryKey: ["exams"] });
			queryClient.invalidateQueries({ queryKey: ["stats"] });
			router.navigate({ to: "/exams" });
		} catch (err) {
			console.error("Failed to delete exam:", err);
		} finally {
			setDeleting(false);
		}
	};

	const startEditing = (q: (typeof exam.questions)[number]) => {
		setEditingQuestionId(q.id);
		setEditForm({
			question: q.question,
			options: [...q.options],
			answer: q.answer,
			explanation: q.explanation || "",
			deepExplanation: q.deepExplanation || "",
			topic: q.topic || "",
		});
	};

	const cancelEditing = () => {
		setEditingQuestionId(null);
		setEditForm(null);
	};

	const handleSave = async (questionId: number) => {
		if (!editForm) return;
		setSaving(true);
		try {
			await updateQuestion({
				data: {
					id: questionId,
					question: editForm.question,
					options: editForm.options,
					answer: editForm.answer,
					explanation: editForm.explanation || "",
					deepExplanation: editForm.deepExplanation || "",
					topic: editForm.topic || "",
				},
			});
			queryClient.invalidateQueries({ queryKey: ["exam-detail", examId] });
			cancelEditing();
		} catch (err) {
			console.error("Failed to update question:", err);
		} finally {
			setSaving(false);
		}
	};

	const { stats } = exam;

	return (
		<div>
			<Link
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
