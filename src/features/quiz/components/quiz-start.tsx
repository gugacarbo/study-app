import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttemptSummary } from "@/features/quiz/types/quiz";

export type QuizStartProps = {
	total: number;
	attempts: AttemptSummary[];
	hasSavedProgress?: boolean;
	isStarting?: boolean;
	onStart: () => void;
	onContinue?: () => void;
};

export function QuizStart({
	total,
	attempts,
	hasSavedProgress = false,
	isStarting = false,
	onStart,
	onContinue,
}: QuizStartProps) {
	const hasUnfinishedAttempt =
		hasSavedProgress || attempts.some((attempt) => attempt.status === "in_progress");
	const inProgressAttempt = attempts.find((attempt) => attempt.status === "in_progress");

	return (
		<Card>
			<CardHeader className="gap-3 border-b pb-3">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle className="text-base">
								{hasUnfinishedAttempt ? "Pronto para continuar?" : "Pronto para começar?"}
							</CardTitle>
							<span className="inline-flex items-center rounded-md border bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
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
							{attempts.map((attempt, index) => (
								<div
									key={attempt.id}
									className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2.5 text-sm"
								>
									<div className="min-w-0 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium">Tentativa #{index + 1}</span>
												<span
													className={cn(
														"inline-flex items-center rounded-md border px-2 py-0.5 text-[0.625rem] font-medium",
														classNameForStatus(attempt.status),
													)}
												>
												{labelForStatus(attempt.status)}
											</span>
										</div>
										<p className="text-[11px] text-muted-foreground">
											{attempt.status === "completed"
												? `${attempt.correctAnswers}/${attempt.totalQuestions} acertos`
												: `${attempt.answeredQuestions}/${attempt.totalQuestions} respondidas`}
										</p>
									</div>
									<div className="shrink-0 text-right">
										<p className="text-sm font-semibold">
													{attempt.status === "completed"
														? `${attempt.scorePercent}%`
														: `${attempt.answeredQuestions}/${attempt.totalQuestions}`}
													</p>
										<p className="text-[11px] text-muted-foreground">
											{attempt.status === "completed" ? "aproveitamento" : "progresso"}
											</p>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
				<p className="px-1 text-[11px] text-muted-foreground">
					Suas respostas ficam salvas durante o progresso e você pode retomar depois se sair da página.
				</p>
			</CardContent>
			<CardFooter
				className={cn(
					"grid gap-2",
					hasUnfinishedAttempt && onContinue ? "sm:grid-cols-2" : "sm:grid-cols-1",
				)}
			>
				{hasUnfinishedAttempt && onContinue && inProgressAttempt && (
					<Button
						className="w-full"
						size="lg"
						variant="outline"
						onClick={onContinue}
						disabled={isStarting}
					>
						Continuar quiz
					</Button>
				)}
				<Button
					className="w-full"
					size="lg"
					onClick={onStart}
					disabled={isStarting}
				>
					{hasUnfinishedAttempt ? "Nova tentativa" : "Começar quiz"}
				</Button>
			</CardFooter>
		</Card>
	);
}

function SummaryTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border bg-muted/40 px-3 py-2">
			<p className="text-[11px] text-muted-foreground">{label}</p>
			<p className="mt-1 font-medium text-foreground">{value}</p>
		</div>
	);
}

function formatQuestionCount(total: number) {
	return `${total} ${total === 1 ? "questão" : "questões"}`;
}

function labelForStatus(status: AttemptSummary["status"]) {
	switch (status) {
		case "completed":
			return "Concluída";
		default:
			return "Em andamento";
	}
}

	function classNameForStatus(status: AttemptSummary["status"]) {
	switch (status) {
		case "completed":
			return "border-success/20 bg-success/10 text-success";
		default:
			return "border-primary/20 bg-primary/10 text-primary";
	}
}
