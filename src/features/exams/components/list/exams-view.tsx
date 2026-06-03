import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteExam, getExamsDetailed } from "@/server-functions/exams";
import { ExamCard } from "./exam-card";
import { ExamsEmptyState } from "./exams-empty-state";

export function ExamsView() {
	const queryClient = useQueryClient();
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

	const { data: exams } = useSuspenseQuery({
		queryKey: ["exams-detailed"],
		queryFn: () => getExamsDetailed(),
	});

	const handleDelete = async (id: number) => {
		setDeletingId(id);
		try {
			await deleteExam({ data: { id } });
			queryClient.invalidateQueries({ queryKey: ["exams-detailed"] });
			queryClient.invalidateQueries({ queryKey: ["exams"] });
			queryClient.invalidateQueries({ queryKey: ["stats"] });
		} catch (err) {
			console.error("Failed to delete exam:", err);
		} finally {
			setDeletingId(null);
			setConfirmDelete(null);
		}
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold">Exams</h1>
				<div className="flex items-center gap-3">
					<span className="text-sm text-text-muted">
						{exams.length} {exams.length === 1 ? "exam" : "exams"}
					</span>
					<Button size="sm" asChild>
						<Link from="/exams" to="/exams/upload">
							<Upload className="h-4 w-4 mr-1.5" />
							Upload
						</Link>
					</Button>
				</div>
			</div>

			{exams.length === 0 ? (
				<ExamsEmptyState />
			) : (
				<div className="space-y-4">
					{exams.map((exam) => (
						<ExamCard
							key={exam.id}
							exam={exam}
							onDelete={handleDelete}
							isDeleting={deletingId === exam.id}
							confirmDelete={confirmDelete}
							onConfirmDelete={setConfirmDelete}
							onCancelDelete={() => setConfirmDelete(null)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
