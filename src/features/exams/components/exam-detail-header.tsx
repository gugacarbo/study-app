import type { ExamDetail } from "@/features/exams/types/exam-detail";

type ExamDetailHeaderProps = {
	exam: Pick<ExamDetail, "name" | "questionCount" | "createdAt">;
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

export function ExamDetailHeader({ exam }: ExamDetailHeaderProps) {
	const createdLabel = formatCreatedAt(exam.createdAt);

	return (
		<header className="flex flex-col gap-1">
			<h1 className="text-xl font-semibold">{exam.name}</h1>
			<p className="text-sm text-muted-foreground">
				{formatQuestionCount(exam.questionCount)}
				{createdLabel ? ` · ${createdLabel}` : null}
			</p>
		</header>
	);
}
