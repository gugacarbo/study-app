import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

interface AnswerRecord {
	question: string;
	userAnswer: string;
	correctAnswers: string[];
	isCorrect: boolean;
	credit: number;
	explanation: string;
	longExplanation?: string;
	topic: string;
}

interface QuizResultsProps {
	score: number;
	total: number;
	answers: AnswerRecord[];
}

function formatScore(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCorrectAnswers(answers: string[]): string {
	return answers.length === 1 ? answers[0] : answers.join("; ");
}

export function QuizResults({ score, total, answers }: QuizResultsProps) {
	const missedPoints = Math.max(total - score, 0);
	const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
	const wrongAnswers = answers.filter((a) => !a.isCorrect);
	const resultLabel =
		accuracy === 100
			? "Mandou bem"
			: accuracy >= 70
				? "Bom resultado"
				: "Pode revisar";

	return (
		<Card
			size="sm"
			className="border border-border/70 bg-card/95 shadow-sm shadow-black/5"
		>
			<CardHeader className="gap-3 border-b border-border/60 pb-3">
				<div className="space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<CardTitle className="text-base">Quiz concluído</CardTitle>
						<span
							className={cn(
								"inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-medium",
								accuracy === 100
									? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
									: accuracy >= 70
										? "border-sky-500/20 bg-sky-500/10 text-sky-300"
										: "border-amber-500/20 bg-amber-500/10 text-amber-300",
							)}
						>
							{resultLabel}
						</span>
					</div>
					<p className="text-sm text-muted-foreground">
						Resumo do seu desempenho neste quiz.
					</p>
				</div>
				<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					<SummaryTile
						label="Pontos"
						value={formatScore(score)}
						valueClassName="text-success"
					/>
					<SummaryTile
						label="Pontos perdidos"
						value={formatScore(missedPoints)}
						valueClassName="text-destructive"
					/>
					<SummaryTile label="Taxa de acerto" value={`${accuracy}%`} />
					<SummaryTile
						label="Resultado"
						value={`${formatScore(score)} / ${total}`}
					/>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{wrongAnswers.length > 0 && (
					<details className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5">
						<summary className="cursor-pointer text-sm font-medium text-muted-foreground">
							Revisar questões erradas ({wrongAnswers.length})
						</summary>
						<div className="mt-3 flex flex-col gap-2">
							{wrongAnswers.map((item) => (
								<WrongAnswerItem key={item.question} item={item} />
							))}
						</div>
					</details>
				)}

				<div className="flex justify-end">
					<Button asChild size="lg">
						<Link from="/quiz/$id" to="/exams">
							Voltar para exames
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function SummaryTile({
	label,
	value,
	valueClassName,
}: {
	label: string;
	value: string;
	valueClassName?: string;
}) {
	return (
		<div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
			<p className="text-[11px] text-muted-foreground">{label}</p>
			<p className={cn("mt-1 text-lg font-semibold", valueClassName)}>
				{value}
			</p>
		</div>
	);
}

function WrongAnswerItem({ item }: { item: AnswerRecord }) {
	const [showLongExplanation, setShowLongExplanation] = useState(false);
	const hasLongExplanation = Boolean(item.longExplanation?.trim());
	const explanationToShow =
		showLongExplanation && hasLongExplanation
			? item.longExplanation || item.explanation
			: item.explanation;

	return (
		<div className="rounded-lg border border-border/70 bg-background/30 px-3 py-2.5">
			<MarkdownRenderer
				content={item.question}
				className="text-sm font-medium"
			/>
			<p className="mt-2 text-[11px] text-muted-foreground">
				Sua resposta:{" "}
				<MarkdownRenderer
					content={item.userAnswer}
					className="inline"
					prose={false}
				/>
			</p>
			<p className="text-[11px] text-muted-foreground">
				{item.correctAnswers.length > 1 ? "Corretas" : "Correta"}:{" "}
				<MarkdownRenderer
					content={formatCorrectAnswers(item.correctAnswers)}
					className="inline"
					prose={false}
				/>
			</p>
			{item.credit > 0 && !item.isCorrect && (
				<p className="text-[11px] text-muted-foreground">
					Crédito parcial: {formatScore(item.credit)}
				</p>
			)}
			{hasLongExplanation && (
				<Button
					variant="ghost"
					size="sm"
					className="mt-2 h-auto px-0 text-xs font-medium"
					onClick={() => setShowLongExplanation((value) => !value)}
				>
					{showLongExplanation
						? "Ver explicação curta"
						: "Ver explicação completa"}
				</Button>
			)}
			<MarkdownRenderer
				content={explanationToShow}
				className="mt-2 text-[11px] text-muted-foreground"
			/>
		</div>
	);
}
