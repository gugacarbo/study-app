import { BookOpenIcon, PlusCircleIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ExamListItem } from "@/features/exams/hooks/use-exams";

type ExamsListProps = {
	exams: ExamListItem[];
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

export function ExamsList({ exams }: ExamsListProps) {
	const navigate = useNavigate();

	if (exams.length === 0) {
		return (
			<div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 text-center">
				<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<BookOpenIcon className="size-7" />
				</div>
				<div className="flex max-w-xs flex-col gap-2">
					<h2 className="text-lg font-semibold">Nenhuma prova ainda</h2>
					<p className="text-sm text-muted-foreground">
						Importe um arquivo .txt ou .md para extrair questões com IA.
					</p>
				</div>
				<Button onClick={() => navigate({ to: "/exams/new" })}>
					<PlusCircleIcon data-icon="inline-start" />
					Importar prova
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm text-muted-foreground">
					{exams.length === 1
						? "1 prova importada"
						: `${exams.length} provas importadas`}
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => navigate({ to: "/exams/new" })}
				>
					<PlusCircleIcon data-icon="inline-start" />
					Importar
				</Button>
			</div>

			<ul className="flex flex-col gap-3">
				{exams.map((exam) => {
					const createdLabel = formatCreatedAt(exam.createdAt);

					return (
						<li key={exam.id}>
							<Card
								className="cursor-pointer transition-colors hover:bg-muted/50"
								role="button"
								tabIndex={0}
								onClick={() =>
									navigate({
										to: "/exams/$examId",
										params: { examId: exam.id },
									})
								}
								onKeyDown={(event) => {
									if (event.key !== "Enter" && event.key !== " ") return;
									event.preventDefault();
									navigate({
										to: "/exams/$examId",
										params: { examId: exam.id },
									});
								}}
							>
								<CardContent className="flex items-start gap-3 pt-6">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
										<BookOpenIcon className="size-5" />
									</div>
									<div className="flex min-w-0 flex-1 flex-col gap-1">
										<p className="truncate font-medium">{exam.name}</p>
										<p className="text-sm text-muted-foreground">
											{formatQuestionCount(exam.questionCount)}
											{exam.source ? ` · ${exam.source}` : null}
											{createdLabel ? ` · ${createdLabel}` : null}
										</p>
									</div>
								</CardContent>
							</Card>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
