import { Link } from "@tanstack/react-router";
import {
	Trash2,
	Play,
	FileText,
	Calendar,
	Tag,
	ListChecks,
	ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function formatFileSize(bytes: number | null): string {
	if (bytes === null || bytes === undefined) return "Unknown";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(dateStr: string | null): string {
	if (!dateStr) return "Unknown";
	try {
		return new Date(dateStr).toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return dateStr;
	}
}

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
					to="/exams/$id"
					params={{ id: exam.id.toString() }}
					className="flex-1 min-w-0 group"
				>
					<h2 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
						{exam.name}
					</h2>
					<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
						<span className="inline-flex items-center gap-1">
							<Calendar className="h-3.5 w-3.5" />
							{formatDate(exam.created_at)}
						</span>
						<span className="inline-flex items-center gap-1">
							<ListChecks className="h-3.5 w-3.5" />
							{exam.questionCount}{" "}
							{exam.questionCount === 1 ? "question" : "questions"}
						</span>
						{exam.source && (
							<span className="inline-flex items-center gap-1 truncate max-w-[200px]">
								<FileText className="h-3.5 w-3.5 shrink-0" />
								<span className="truncate">{exam.source}</span>
							</span>
						)}
					</div>
					{exam.topics.length > 0 && (
						<div className="mt-3 flex flex-wrap items-center gap-1.5">
							<Tag className="h-3.5 w-3.5 text-text-muted shrink-0" />
							{exam.topics.map((topic) => (
								<Badge variant="secondary" key={topic}>
									{topic}
								</Badge>
							))}
						</div>
					)}
					{exam.files.length > 0 && (
						<div className="mt-3 space-y-1">
							{exam.files.map((file) => (
								<div
									key={file.id}
									className="flex items-center gap-2 text-xs text-text-muted"
								>
									<FileText className="h-3 w-3 shrink-0" />
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
						<Link to="/quiz/$id" params={{ id: exam.id.toString() }}>
							<Play />
							Quiz
						</Link>
					</Button>
					<Button variant="outline" size="sm" asChild>
						<Link to="/exams/$id" params={{ id: exam.id.toString() }}>
							<ChevronRight />
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
							size="icon-sm"
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
