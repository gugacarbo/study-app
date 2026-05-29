import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { getExamsDetailed, deleteExam } from "../../server-functions/exams";
import { UploadForm } from "../upload-form/upload-form";
import { ExamCard } from "./exam-card";
import { ExamsEmptyState } from "./exams-empty-state";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ExamsView() {
	const queryClient = useQueryClient();
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
	const [uploadOpen, setUploadOpen] = useState(false);

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
					<Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
						<DialogTrigger asChild>
							<Button size="sm">
								<Upload className="h-4 w-4 mr-1.5" />
								Upload
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Upload Exam</DialogTitle>
							</DialogHeader>
							<UploadForm onSuccess={() => setUploadOpen(false)} />
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{exams.length === 0 ? (
				<ExamsEmptyState
					uploadOpen={uploadOpen}
					onUploadOpenChange={setUploadOpen}
					onUploadSuccess={() => setUploadOpen(false)}
				/>
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
