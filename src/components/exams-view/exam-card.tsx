import { Link } from "@tanstack/react-router";
import {
	Calendar,
	ChevronRight,
	FileText,
	ListChecks,
	Play,
	Tag,
	Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatFileSize } from "./exam-card-utils";

interface ExamCardProps {
	exam: {
		id: number;
		name: string;
		created_at: string | null;
		questionCount: number;
		source: string | null;
		topics: string[];
		files: Array<{ id: number; name: string; size: number | null }>;
	};
	onDelete: (id: number) => void;
	isDeleting: boolean;
	confirmDelete: number | null;
	onConfirmDelete: (id: number) => void;
	onCancelDelete: () => void;
}

export function ExamCard({
	exam,
	onDelete,
	isDeleting,
	confirmDelete,
	onConfirmDelete,
	onCancelDelete,
}: ExamCardProps) {
	return (
		<Card>
			<div className="flex items-start justify-between gap-4 px-4 py-3">
				<Link
					from="/exams"
					to="/exams/$id"
					params={{ id: exam.id.toString() }}
					className="flex flex-col gap-3 flex-1 min-w-0 group"
				>
					<h2 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
						{exam.name}
					</h2>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
						<span className="inline-flex items-center gap-1">
							<Calendar className="size-3.5" />
							{formatDate(exam.created_at)}
						</span>
						<span className="inline-flex items-center gap-1">
							<ListChecks className="size-3.5" />
							{exam.questionCount}{" "}
							{exam.questionCount === 1 ? "question" : "questions"}
						</span>
						{exam.source && (
							<span className="inline-flex items-center gap-1 truncate max-w-[200px]">
								<FileText className="size-3.5 shrink-0" />
								<span className="truncate">{exam.source}</span>
							</span>
						)}
					</div>
					{exam.topics.length > 0 && (
						<div className="flex flex-wrap items-center gap-1.5">
							<Tag className="size-3.5 text-muted-foreground shrink-0" />
							{exam.topics.map((topic) => (
								<Badge variant="secondary" key={topic}>
									{topic}
								</Badge>
							))}
						</div>
					)}
					{exam.files.length > 0 && (
						<div className="flex flex-col gap-1">
							{exam.files.map((file) => (
								<div
									key={file.id}
									className="flex items-center gap-2 text-xs text-muted-foreground"
								>
									<FileText className="size-3 shrink-0" />
									<span className="truncate">{file.name}</span>
									{file.size !== null && file.size !== undefined && (
										<span>({formatFileSize(file.size)})</span>
									)}
								</div>
							))}
						</div>
					)}
				</Link>
				<div className="flex flex-col gap-2 shrink-0">
					<Button variant="default" size="sm" asChild>
						<Link from="/exams" to="/quiz/$id" params={{ id: exam.id.toString() }}>
							<Play data-icon="inline-start" />
							Quiz
						</Link>
					</Button>
					<Button variant="outline" size="sm" asChild>
						<Link from="/exams" to="/exams/$id" params={{ id: exam.id.toString() }}>
							<ChevronRight data-icon="inline-start" />
							Details
						</Link>
					</Button>
					{confirmDelete === exam.id ? (
						<div className="flex gap-1.5">
							<Button
								variant="destructive"
								size="xs"
								onClick={() => onDelete(exam.id)}
								disabled={isDeleting}
							>
								{isDeleting ? "..." : "Confirm"}
							</Button>
							<Button variant="ghost" size="xs" onClick={onCancelDelete}>
								Cancel
							</Button>
						</div>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
							onClick={() => onConfirmDelete(exam.id)}
						>
							<Trash2 />
						</Button>
					)}
				</div>
			</div>
		</Card>
	);
}
