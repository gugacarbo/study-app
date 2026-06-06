import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuizAttemptSummary {
	id: number;
	total_questions: number;
	answered_questions: number;
	correct_answers: number;
	status: "in_progress" | "completed" | "abandoned";
	accuracy: number;
	started_at: string | null;
}

export function QuizStart({
	total,
	onStart,
	onRestart,
	hasSavedProgress,
	attempts = [],
}: {
	total: number;
	onStart: () => void;
	onRestart?: () => void;
	hasSavedProgress?: boolean;
	attempts?: QuizAttemptSummary[];
}) {
	const hasUnfinishedAttempt =
		hasSavedProgress ||
		attempts.some((attempt) => attempt.status === "in_progress");

	return (
		<Card
			size="sm"
			className="border border-border/70 bg-card/95 shadow-sm shadow-black/5"
		>
			<CardHeader className="gap-3 border-b border-border/60 pb-3">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle className="text-base">
								{hasUnfinishedAttempt
									? "Pronto para continuar?"
									: "Pronto para começar?"}
							</CardTitle>
							<span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
								{hasUnfinishedAttempt ? "Progresso salvo" : "Novo quiz"}
							</span>
						</div>
						<p className="max-w-2xl text-sm text-muted-foreground">
							{hasUnfinishedAttempt
								? `Você tem ${formatQuestionCount(total)} neste quiz e já existe progresso salvo para retomar.`
								: `O quiz vai abrir ${formatQuestionCount(total)} para você responder em sequência.`}
						</p>
					</div>
				</div>
				<div className="grid gap-2 sm:grid-cols-3">
					<SummaryTile label="Questões" value={formatQuestionCount(total)} />
					<SummaryTile
						label="Tentativas"
						value={attempts.length > 0 ? String(attempts.length) : "Nenhuma"}
					/>
					<SummaryTile
						label="Salvamento"
						value={hasUnfinishedAttempt ? "Retomar depois" : "Local"}
					/>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{attempts.length > 0 && (
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-3">
							<h3 className="text-sm font-medium">Tentativas anteriores</h3>
							<span className="text-[11px] text-muted-foreground">
								{attempts.length} registro{attempts.length === 1 ? "" : "s"}
							</span>
						</div>
						<div className="space-y-2">
							{attempts.map((attempt) => (
								<div
									key={attempt.id}
									className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-sm"
								>
									<div className="min-w-0 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium">
												Tentativa #{attempt.id}
											</span>
											<span
												className={cn(
													"inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-medium",
													classNameForStatus(attempt.status),
												)}
											>
												{labelForStatus(attempt.status)}
											</span>
										</div>
										<p className="text-[11px] text-muted-foreground">
											{attempt.status === "completed"
												? `${attempt.correct_answers}/${attempt.total_questions} acertos`
												: `${attempt.answered_questions}/${attempt.total_questions} respondidas`}
										</p>
									</div>
									<div className="shrink-0 text-right">
										<p className="text-sm font-semibold">
											{attempt.status === "completed"
												? `${attempt.accuracy}%`
												: `${attempt.answered_questions}/${attempt.total_questions}`}
										</p>
										<p className="text-[11px] text-muted-foreground">
											{attempt.status === "completed"
												? "aproveitamento"
												: "progresso"}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
				<p className="px-1 text-[11px] text-muted-foreground">
					Suas respostas ficam salvas localmente durante o progresso e você pode
					retomar depois se sair da página.
				</p>
				<div
					className={cn(
						"grid gap-2",
						hasUnfinishedAttempt && onRestart
							? "sm:grid-cols-2"
							: "sm:grid-cols-1",
					)}
				>
					{hasUnfinishedAttempt && onRestart && (
						<Button
							className="w-full"
							size="lg"
							variant="outline"
							onClick={onRestart}
						>
							Recomeçar
						</Button>
					)}
					<Button className="w-full" size="lg" onClick={onStart}>
						{hasUnfinishedAttempt ? "Continuar quiz" : "Começar quiz"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function SummaryTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
			<p className="text-[11px] text-muted-foreground">{label}</p>
			<p className="mt-1 font-medium text-foreground">{value}</p>
		</div>
	);
}

function formatQuestionCount(total: number) {
	return `${total} ${total === 1 ? "questão" : "questões"}`;
}

function labelForStatus(status: QuizAttemptSummary["status"]) {
	switch (status) {
		case "completed":
			return "Concluída";
		case "abandoned":
			return "Abandonada";
		default:
			return "Em andamento";
	}
}

function classNameForStatus(status: QuizAttemptSummary["status"]) {
	switch (status) {
		case "completed":
			return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
		case "abandoned":
			return "border-amber-500/20 bg-amber-500/10 text-amber-300";
		default:
			return "border-sky-500/20 bg-sky-500/10 text-sky-300";
	}
}
