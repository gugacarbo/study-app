import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AttemptResult } from "@/features/quiz/types/quiz";

type QuizAnswerReviewProps = {
	result: AttemptResult;
};

function formatOptionKey(key: string): string {
	return key.toLowerCase();
}

export function QuizAnswerReview({ result }: QuizAnswerReviewProps) {
	return (
		<div className="flex flex-col gap-4">
			{result.questions.map((item, index) => {
				const correctSet = new Set(item.correctOptionIds);
				const selectedSet = new Set(item.selectedOptionIds);
				const isAnswered = selectedSet.size > 0;
				const isCorrect = item.credit > 0;

				return (
					<Card key={item.questionId}>
						<CardHeader className="flex flex-row items-start justify-between gap-3">
							<CardTitle className="text-base font-medium leading-snug">
								{index + 1}. {item.question}
							</CardTitle>
							{isAnswered ? (
								<Badge
									variant={isCorrect ? "default" : "destructive"}
									className={
										isCorrect ? "bg-emerald-500 text-white" : ""
									}
								>
									{isCorrect ? "Correta" : "Incorreta"}
								</Badge>
							) : (
								<Badge variant="outline">Não respondida</Badge>
							)}
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<ul className="flex flex-col gap-2">
								{item.options.map((option) => {
									const isCorrectOption = correctSet.has(option.id);
									const isSelected = selectedSet.has(option.id);

									let stateClass =
										"flex items-start gap-2 rounded-md border px-3 py-2 text-sm";
									if (isCorrectOption) {
										stateClass +=
											" border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20";
									} else if (isSelected) {
										stateClass +=
											" border-red-300 bg-red-50/50 dark:bg-red-950/20";
									} else {
										stateClass += " border-input text-muted-foreground";
									}

									return (
										<li key={option.id} className={stateClass}>
											<span className="font-medium tabular-nums">
												{formatOptionKey(option.id)})
											</span>
											<span>{option.text}</span>
										</li>
									);
								})}
							</ul>

							<Separator />

							<div className="flex flex-col gap-1 text-sm">
								<p>
									<span className="font-medium">Resposta correta:</span>{" "}
									{item.correctOptionIds.length > 0
										? item.correctOptionIds
												.map(formatOptionKey)
												.join(", ")
											: "—"}
								</p>
								<p>
									<span className="font-medium">Sua resposta:</span>{" "}
									{isAnswered
										? item.selectedOptionIds
												.map(formatOptionKey)
												.join(", ")
											: "—"}
								</p>
								{item.explanation ? (
									<p className="text-muted-foreground">
										<span className="font-medium text-foreground">
											Explicação:
										</span>{" "}
										{item.explanation}
									</p>
								) : null}
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
