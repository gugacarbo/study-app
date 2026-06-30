import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type QuizResultSummaryProps = {
	scorePercent: number;
	totalQuestions: number;
	answeredQuestions: number;
	correctAnswers: number;
	onNewAttempt: () => void;
	isStarting?: boolean;
};

function formatPercent(value: number): string {
	return `${Math.round(value)}%`;
}

function getPerformanceCopy(scorePercent: number) {
	if (scorePercent >= 85) {
		return {
			band: "Base bem consolidada",
			message: "Você sustentou a sessão com segurança e pouca oscilação.",
			accentClass: "bg-success",
			bandClass: "text-success",
			badgeClass:
				"border-success/20 bg-success/10 text-success hover:bg-success/15",
		};
	}

	if (scorePercent >= 70) {
		return {
			band: "Bom domínio da matéria",
			message: "A leitura está consistente; vale revisar só os pontos de escape.",
			accentClass: "bg-chart-4",
			bandClass: "text-chart-4",
			badgeClass:
				"border-chart-4/20 bg-chart-4/10 text-chart-4 hover:bg-chart-4/15",
		};
	}

	if (scorePercent >= 50) {
		return {
			band: "Aprendizado em andamento",
			message: "A sessão mostrou progresso, mas ainda há lacunas claras para revisar.",
			accentClass: "bg-chart-5",
			bandClass: "text-chart-5",
			badgeClass:
				"border-chart-5/20 bg-chart-5/10 text-chart-5 hover:bg-chart-5/15",
		};
	}

	return {
		band: "Revisão prioritária",
		message: "Vale retomar a correção com calma e usar os erros como roteiro de estudo.",
		accentClass: "bg-destructive",
		bandClass: "text-destructive",
		badgeClass:
			"border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15",
	};
}

export function QuizResultSummary({
	scorePercent,
	totalQuestions,
	answeredQuestions,
	correctAnswers,
	onNewAttempt,
	isStarting = false,
}: QuizResultSummaryProps) {
	const performance = getPerformanceCopy(scorePercent);

	return (
		<Card className="overflow-hidden border bg-card">
			<CardHeader className="gap-5 border-b border-border bg-muted/30 px-5 py-5 sm:px-6">
				<div className="flex flex-col gap-3">
					<Badge
						variant="outline"
						className={`w-fit rounded-md px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] ${performance.badgeClass}`}
					>
						Boletim da sessão
					</Badge>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
						<div className="space-y-2">
							<CardTitle className="font-serif text-2xl font-medium tracking-[-0.02em] text-foreground sm:text-3xl">
								Fechamento da tentativa
							</CardTitle>
							<p className="max-w-2xl font-body text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
								{performance.message}
							</p>
						</div>
						<div className="flex items-end gap-3 lg:shrink-0">
							<div className="font-serif text-6xl font-medium leading-none tracking-[-0.06em] text-foreground sm:text-7xl">
								{formatPercent(scorePercent)}
							</div>
							<div className={`mb-1 h-14 w-1.5 rounded-full sm:h-16 ${performance.accentClass}`} />
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-6 px-5 py-5 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="space-y-1">
						<p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Faixa de desempenho
						</p>
						<p className={`font-body text-lg font-medium tracking-[-0.02em] ${performance.bandClass}`}>
							{performance.band}
						</p>
					</div>
					<p className="font-body text-sm leading-6 text-muted-foreground">
						Leitura rápida da sessão antes de revisar cada questão.
					</p>
				</div>

				<Separator className="bg-border" />

				<div className="grid gap-3 sm:grid-cols-2">
					<div className="rounded-lg border border-success/20 bg-success/10 p-4 sm:col-span-2">
						<p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Acertos
						</p>
						<div className="mt-3 flex items-end justify-between gap-3">
							<div>
								<p className="font-serif text-4xl font-medium tracking-[-0.05em] text-foreground sm:text-5xl">
									{correctAnswers}
								</p>
								<p className="mt-2 font-body text-sm leading-6 text-muted-foreground">
									Questões respondidas corretamente nesta sessão.
								</p>
							</div>
							<div className="rounded-md border border-success/20 bg-background/80 px-3 py-1 text-sm font-medium text-success">
								foco da sessão
							</div>
						</div>
					</div>
					<div className="rounded-lg border border-chart-4/20 bg-chart-4/10 p-4">
						<p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Respondidas
						</p>
						<p className="mt-3 font-serif text-3xl font-medium tracking-[-0.04em] text-foreground">
							{answeredQuestions}
						</p>
						<p className="mt-2 font-body text-sm leading-6 text-muted-foreground">
							Medida de consistência da tentativa.
						</p>
					</div>
					<div className="rounded-lg border bg-muted/30 p-4">
						<p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Total
						</p>
						<p className="mt-3 font-serif text-3xl font-medium tracking-[-0.04em] text-foreground">
							{totalQuestions}
						</p>
						<p className="mt-2 font-body text-sm leading-6 text-muted-foreground">
							Escopo completo selecionado para o quiz.
						</p>
					</div>
				</div>

				<Button
					onClick={onNewAttempt}
					disabled={isStarting}
					className="w-full sm:ml-auto sm:w-auto"
				>
					{isStarting ? "Preparando…" : "Nova tentativa"}
				</Button>
			</CardContent>
		</Card>
	);
}
