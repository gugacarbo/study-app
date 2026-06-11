import { Link } from "@tanstack/react-router";
import { Pencil, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useExamNameEditing } from "./use-exam-name-editing";

interface ExamHeaderProps {
	exam: {
		name: string;
		source: string | null;
		id: number;
		questions: Array<{
			id: number;
			question: string;
			explanation: string;
			deepExplanation: string;
		}>;
	};
	confirmDelete: boolean;
	setConfirmDelete: (v: boolean) => void;
	deleting: boolean;
	handleDelete: () => void;
}

export function ExamHeader({
	exam,
	confirmDelete,
	setConfirmDelete,
	deleting,
	handleDelete,
}: ExamHeaderProps) {
	const {
		isEditing,
		draftName,
		saving,
		startEditing,
		setDraftName,
		handleKeyDown,
		handleBlur,
	} = useExamNameEditing({ examId: exam.id, initialName: exam.name });

	return (
		<div className="flex items-start justify-between gap-4 mb-6">
			<div className="flex-1 min-w-0">
				<div className="group flex min-w-0 items-center gap-1.5">
					{isEditing ? (
						<Input
							value={draftName}
							onChange={(event) => setDraftName(event.target.value)}
							onBlur={handleBlur}
							onKeyDown={handleKeyDown}
							disabled={saving}
							autoFocus
							aria-label="Exam name"
							className={cn(
								"h-8 min-h-8 min-w-0 flex-1 rounded-sm border-0 bg-transparent p-0 shadow-none",
								"text-2xl font-bold leading-8 md:text-2xl md:leading-8",
								"ring-0 focus-visible:border-0 focus-visible:bg-input/20 focus-visible:ring-0",
							)}
						/>
					) : (
						<>
							<button
								type="button"
								onClick={startEditing}
								className="min-w-0 flex-1 truncate text-left text-2xl font-bold transition-colors hover:text-foreground/80"
							>
								{exam.name}
							</button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
								onClick={startEditing}
								aria-label="Edit exam name"
							>
								<Pencil className="h-3.5 w-3.5" />
							</Button>
						</>
					)}
				</div>
				{exam.source && (
					<p className="text-sm text-muted-foreground mt-1 truncate">
						{exam.source}
					</p>
				)}
			</div>

			<div className="flex gap-2 shrink-0">
				<Button asChild variant="default" size="sm">
					<Link
						from="/exams/$id"
						to="/quiz/$id"
						params={{ id: exam.id.toString() }}
					>
						<Play className="h-4 w-4" />
						Start Quiz
					</Link>
				</Button>

				{confirmDelete ? (
					<div className="flex gap-1.5">
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDelete}
							disabled={deleting}
						>
							{deleting ? "..." : "Confirm"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setConfirmDelete(false)}
						>
							Cancel
						</Button>
					</div>
				) : (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setConfirmDelete(true)}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				)}
			</div>
		</div>
	);
}
