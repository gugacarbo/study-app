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
		<header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
			<div className="min-w-0 flex-1">
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
								"text-xl font-bold leading-8 sm:text-2xl sm:leading-8",
								"ring-0 focus-visible:border-0 focus-visible:bg-input/20 focus-visible:ring-0",
							)}
						/>
					) : (
						<>
							<button
								type="button"
								onClick={startEditing}
								className="min-w-0 flex-1 truncate text-left text-xl font-bold transition-colors hover:text-foreground/80 sm:text-2xl"
							>
								{exam.name}
							</button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8 shrink-0 opacity-100 sm:size-7 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
								onClick={startEditing}
								aria-label="Edit exam name"
							>
								<Pencil className="size-3.5" />
							</Button>
						</>
					)}
				</div>
				{exam.source && (
					<p className="mt-0.5 truncate text-sm text-muted-foreground">
						{exam.source}
					</p>
				)}
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<Button asChild className="min-h-10 flex-1 sm:min-h-8 sm:flex-none" size="sm">
					<Link
						from="/exams/$id"
						to="/quiz/$id"
						params={{ id: exam.id.toString() }}
					>
						<Play className="size-4" />
						Start Quiz
					</Link>
				</Button>

				{confirmDelete ? (
					<div className="flex shrink-0 gap-1.5">
						<Button
							variant="destructive"
							size="sm"
							className="min-h-10 sm:min-h-8"
							onClick={handleDelete}
							disabled={deleting}
						>
							{deleting ? "..." : "Confirm"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="min-h-10 sm:min-h-8"
							onClick={() => setConfirmDelete(false)}
						>
							Cancel
						</Button>
					</div>
				) : (
					<Button
						variant="outline"
						size="icon"
						className="size-10 shrink-0 sm:size-8"
						onClick={() => setConfirmDelete(true)}
						aria-label="Delete exam"
					>
						<Trash2 className="size-4" />
					</Button>
				)}
			</div>
		</header>
	);
}
