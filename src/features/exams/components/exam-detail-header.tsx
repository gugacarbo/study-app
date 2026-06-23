import { Link } from "@tanstack/react-router";
import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExamDetail } from "@/features/exams/types/exam-detail";

type ExamDetailHeaderProps = {
	exam: Pick<ExamDetail, "name" | "questionCount" | "createdAt">;
	ingestJobId?: string | null;
};

function formatQuestionCount(count: number): string {
	if (count === 0) return "Sem questões";
	if (count === 1) return "1 questão";
	return `${count} questões`;
}

function formatCreatedAt(createdAt: string | null): string | null {
	if (!createdAt) return null;
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export function ExamDetailHeader({ exam, ingestJobId }: ExamDetailHeaderProps) {
	const createdLabel = formatCreatedAt(exam.createdAt);

	return (
		<header className="flex flex-col gap-1">
			<div className="flex items-center justify-between gap-2">
				<h1 className="text-xl font-semibold">{exam.name}</h1>
				{ingestJobId ? (
					<Button asChild variant="outline" size="sm">
						<Link to="/jobs/$jobId" params={{ jobId: ingestJobId }}>
							<EyeIcon data-icon="inline-start" />
							Job de extração
						</Link>
					</Button>
				) : null}
			</div>
			<p className="text-sm text-muted-foreground">
				{formatQuestionCount(exam.questionCount)}
				{createdLabel ? ` · ${createdLabel}` : null}
			</p>
		</header>
	);
}
