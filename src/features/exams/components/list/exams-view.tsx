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
		<section
			data-fullwidth
			data-testid="exams-view"
			className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto"
		>
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-5 pt-3 lg:px-6">
				<div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-2xl font-bold tracking-tight">Exams</h1>
							<span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[0.6875rem] font-medium text-muted-foreground">
								{exams.length} {exams.length === 1 ? "exam" : "exams"}
							</span>
						</div>
						<p className="max-w-3xl text-sm text-muted-foreground">
							Compact summaries with quick actions for quiz, details, or
							cleanup.
						</p>
					</div>
					<Button size="sm" asChild>
						<Link from="/exams" to="/exams/upload">
							<Upload className="mr-1.5 h-4 w-4" />
							Upload
						</Link>
					</Button>
				</div>

				{exams.length === 0 ? (
					<ExamsEmptyState />
				) : (
					<div
						data-testid="exams-grid"
						className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
					>
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
		</section>
	);
}
