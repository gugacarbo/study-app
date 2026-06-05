import { Link } from "@tanstack/react-router";
import { Calendar, ListChecks, Tag, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
	const visibleTopics = exam.topics.slice(0, 1);
	const hiddenTopicsCount = Math.max(
		exam.topics.length - visibleTopics.length,
		0,
	);
	const filesLabel = exam.files.length === 1 ? "file" : "files";
	const topicsLabel = exam.topics.length === 1 ? "topic" : "topics";
	const questionsLabel = exam.questionCount === 1 ? "question" : "questions";

	return (
		<Card
			size="sm"
			className="group relative h-full gap-3 border border-border/60 bg-card/95 shadow-sm transition-shadow hover:shadow-md"
		>
			<Link
				from="/exams"
				to="/exams/$id"
				params={{ id: exam.id.toString() }}
				aria-label={`Open exam ${exam.name}`}
				className="absolute inset-0 z-0 rounded-lg"
			/>

			<CardHeader className="pointer-events-none relative z-10 gap-2 border-b border-border/60 pb-2.5">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<CardTitle
							data-testid={`exam-title-${exam.id}`}
							className="line-clamp-2 text-[0.95rem] font-semibold leading-snug transition-colors group-hover:text-primary"
						>
							{exam.name}
						</CardTitle>
					</div>
					{confirmDelete === exam.id ? (
						<div className="pointer-events-auto relative z-20 flex items-center gap-1.5">
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
							className="pointer-events-auto relative z-20 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
							onClick={() => onConfirmDelete(exam.id)}
						>
							<Trash2 />
						</Button>
					)}
				</div>
			</CardHeader>

			<CardContent className="pointer-events-none relative z-10 flex flex-1 flex-col gap-2.5 pt-0">
				<div
					data-testid={`exam-meta-${exam.id}`}
					className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground"
				>
					<Badge variant="outline">
						{exam.source?.trim() ? exam.source : "Uploaded file"}
					</Badge>
					<span className="inline-flex items-center gap-1">
						<Calendar className="size-3" />
						{formatDate(exam.created_at)}
					</span>
				</div>

				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
					<div className="inline-flex items-center gap-1.5 text-muted-foreground">
						<ListChecks className="size-3.5" />
						<span className="font-semibold text-foreground">
							{exam.questionCount} {questionsLabel}
						</span>
					</div>
					<div className="inline-flex items-center gap-1.5 text-muted-foreground">
						<span className="font-semibold text-foreground">
							{exam.files.length} {filesLabel}
						</span>
						{exam.files[0]?.size !== null &&
							exam.files[0]?.size !== undefined && (
								<span className="text-[0.6875rem] text-muted-foreground">
									{formatFileSize(exam.files[0].size)}
								</span>
							)}
					</div>
					<div className="inline-flex items-center gap-1.5 text-muted-foreground">
						<Tag className="size-3.5" />
						<span className="font-semibold text-foreground">
							{exam.topics.length} {topicsLabel}
						</span>
					</div>
				</div>

				{exam.topics.length > 0 && (
					<div
						data-testid={`exam-topics-${exam.id}`}
						className="flex flex-nowrap items-center gap-1.5 overflow-hidden"
					>
						{visibleTopics.map((topic) => (
							<Badge
								variant="secondary"
								key={topic}
								className="min-w-0 max-w-full shrink truncate"
							>
								{topic}
							</Badge>
						))}
						{hiddenTopicsCount > 0 && (
							<Badge variant="outline" className="shrink-0">
								+{hiddenTopicsCount} more
							</Badge>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
