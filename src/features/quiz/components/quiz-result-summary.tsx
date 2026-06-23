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

export function QuizResultSummary({
	scorePercent,
	totalQuestions,
	answeredQuestions,
	correctAnswers,
	onNewAttempt,
	isStarting = false,
}: QuizResultSummaryProps) {
	const label =
		scorePercent >= 70
			? "Ótimo desempenho"
			: scorePercent >= 50
				? "Bom desempenho"
					: "Precisa praticar mais";

	const badgeVariant =
		scorePercent >= 70 ? "default" : scorePercent >= 50 ? "secondary" : "outline";

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">Resultado do quiz</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<div className="flex flex-col items-center gap-2">
					<div className="text-5xl font-bold tracking-tight">
						{formatPercent(scorePercent)}
					</div>
					<Badge variant={badgeVariant}>{label}</Badge>
				</div>

				<Separator />

				<div className="grid grid-cols-3 gap-4 text-center">
					<div className="flex flex-col gap-1">
						<span className="text-2xl font-semibold">{totalQuestions}</span>
						<span className="text-xs text-muted-foreground">Total</span>
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-2xl font-semibold">{answeredQuestions}</span>
						<span className="text-xs text-muted-foreground">Respondidas</span>
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-2xl font-semibold">{correctAnswers}</span>
						<span className="text-xs text-muted-foreground">Acertos</span>
					</div>
				</div>

				<Button
					onClick={onNewAttempt}
					disabled={isStarting}
					className="w-full"
				>
					{isStarting ? "Preparando…" : "Nova tentativa"}
				</Button>
			</CardContent>
		</Card>
	);
}
