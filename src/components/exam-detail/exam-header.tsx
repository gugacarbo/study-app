import { Link } from "@tanstack/react-router";
import { Play, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger } from "../ui/dialog";
import { ExplanationDialog } from "./explanation-dialog";

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
	explanationsDialogOpen: boolean;
	setExplanationsDialogOpen: (v: boolean) => void;
	examId: number;
}

export function ExamHeader({
	exam,
	confirmDelete,
	setConfirmDelete,
	deleting,
	handleDelete,
	explanationsDialogOpen,
	setExplanationsDialogOpen,
	examId,
}: ExamHeaderProps) {
	return (
		<div className="flex items-start justify-between gap-4 mb-6">
			<div className="flex-1 min-w-0">
				<h1 className="text-2xl font-bold truncate">{exam.name}</h1>
				{exam.source && (
					<p className="text-sm text-muted-foreground mt-1 truncate">
						{exam.source}
					</p>
				)}
			</div>

			<div className="flex gap-2 shrink-0">
				<Dialog
					open={explanationsDialogOpen}
					onOpenChange={setExplanationsDialogOpen}
				>
					<DialogTrigger asChild>
						<Button variant="outline" size="sm">
							Explicações
						</Button>
					</DialogTrigger>
					<ExplanationDialog
						open={explanationsDialogOpen}
						examId={examId}
						questions={exam.questions}
						questionCount={exam.questions.length}
					/>
				</Dialog>

				<Button asChild variant="default" size="sm">
					<Link to="/quiz/$id" params={{ id: exam.id.toString() }}>
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
