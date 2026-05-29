import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ui/markdown";

interface AnswerRecord {
	question: string;
	userAnswer: string;
	correctAnswer: string;
	isCorrect: boolean;
	explanation: string;
	topic: string;
}

interface QuizResultsProps {
	score: number;
	total: number;
	answers: AnswerRecord[];
}

export function QuizResults({ score, total, answers }: QuizResultsProps) {
	const incorrect = Math.max(total - score, 0);
	const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
	const wrongAnswers = answers.filter((a) => !a.isCorrect);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Quiz Complete!</CardTitle>
				<p className="text-muted-foreground text-sm">
					Resumo do seu desempenho
				</p>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-2">
					<Card className="py-3 gap-1">
						<CardContent className="px-3 py-2">
							<p className="text-xs text-muted-foreground">Acertos</p>
							<p className="text-lg font-semibold text-success">{score}</p>
						</CardContent>
					</Card>
					<Card className="py-3 gap-1">
						<CardContent className="px-3 py-2">
							<p className="text-xs text-muted-foreground">Erros</p>
							<p className="text-lg font-semibold text-destructive">
								{incorrect}
							</p>
						</CardContent>
					</Card>
					<Card className="py-3 gap-1">
						<CardContent className="px-3 py-2">
							<p className="text-xs text-muted-foreground">Taxa de acerto</p>
							<p className="text-lg font-semibold">{accuracy}%</p>
						</CardContent>
					</Card>
					<Card className="py-3 gap-1">
						<CardContent className="px-3 py-2">
							<p className="text-xs text-muted-foreground">Resultado</p>
							<p className="text-lg font-semibold">
								{score} / {total}
							</p>
						</CardContent>
					</Card>
				</div>

				{wrongAnswers.length > 0 && (
					<details className="mt-4 rounded-lg border border-border p-3">
						<summary className="cursor-pointer text-sm font-medium text-muted-foreground">
							Revisar questões erradas ({wrongAnswers.length})
						</summary>
						<div className="mt-3 flex flex-col gap-3">
							{wrongAnswers.map((item) => (
								<div
									key={item.question}
									className="rounded-lg border border-border p-3"
								>
									<MarkdownRenderer
										content={item.question}
										className="text-sm font-medium"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Sua resposta:{" "}
										<MarkdownRenderer
											content={item.userAnswer}
											className="inline"
											prose={false}
										/>
									</p>
									<p className="text-xs text-muted-foreground">
										Correta:{" "}
										<MarkdownRenderer
											content={item.correctAnswer}
											className="inline"
											prose={false}
										/>
									</p>
									<MarkdownRenderer
										content={item.explanation}
										className="text-xs mt-2 text-muted-foreground"
									/>
								</div>
							))}
						</div>
					</details>
				)}
			</CardContent>
		</Card>
	);
}
