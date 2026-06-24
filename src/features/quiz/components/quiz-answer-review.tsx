import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AttemptResult } from "@/features/quiz/types/quiz";

type QuizAnswerReviewProps = {
	result: AttemptResult;
};

function formatOptionKey(key: string): string {
	return key.toUpperCase();
}

function formatLegacyOptionKey(key: string): string {
	return key.toLowerCase();
}

function formatOptionList(optionIds: string[]): string {
	if (optionIds.length === 0) {
		return "—";
	}

	return optionIds.map(formatOptionKey).join(", ");
}

function formatLegacyOptionList(optionIds: string[]): string {
	if (optionIds.length === 0) {
		return "—";
	}

	return optionIds.map(formatLegacyOptionKey).join(", ");
}

function matchesExactly(selectedSet: Set<string>, correctSet: Set<string>): boolean {
	if (selectedSet.size !== correctSet.size) {
		return false;
	}

	for (const optionId of selectedSet) {
		if (!correctSet.has(optionId)) {
			return false;
		}
	}

	return true;
}

export function QuizAnswerReview({ result }: QuizAnswerReviewProps) {
	return (
		<div className="flex flex-col gap-4">
			{result.questions.map((item, index) => {
				const correctSet = new Set(item.correctOptionIds);
				const selectedSet = new Set(item.selectedOptionIds);
				const isAnswered = selectedSet.size > 0;
				const isExactMatch = isAnswered
					? matchesExactly(selectedSet, correctSet)
					: false;
				const isPartiallyCorrect =
					isAnswered && item.credit > 0 && !isExactMatch;

				const status = !isAnswered
					? {
							label: "Não respondida",
							description: "Nenhuma alternativa foi marcada.",
							badgeClass:
								"border-border bg-muted text-foreground",
							panelClass:
								"border-border/70 bg-muted/50",
						}
					: isExactMatch
						? {
								label: "Resposta correta",
								description: "Sua marcação coincide com o gabarito.",
								badgeClass:
									"border-success/25 bg-success/10 text-success",
								panelClass:
									"border-success/20 bg-success/10",
							}
						: isPartiallyCorrect
							? {
									label: "Resposta parcial",
									description:
										"Parte da sua seleção coincide com o gabarito.",
									badgeClass:
										"border-chart-5/25 bg-chart-5/10 text-chart-5",
									panelClass:
										"border-chart-5/20 bg-chart-5/10",
								}
							: {
									label: "Resposta incorreta",
									description: "Sua marcação não corresponde ao gabarito.",
									badgeClass:
										"border-destructive/25 bg-destructive/10 text-destructive",
									panelClass:
										"border-destructive/20 bg-destructive/10",
								};

				return (
					<Card
						key={item.questionId}
						className="border-border/70 bg-card/95 shadow-sm"
					>
						<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0 space-y-2">
								<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									Questão {index + 1}
								</p>
								<CardTitle className="text-base font-semibold leading-relaxed text-foreground">
									{item.question}
								</CardTitle>
							</div>

							<div
								className={`w-full shrink-0 rounded-xl border px-4 py-3 sm:max-w-64 ${status.panelClass}`}
							>
								<Badge
									variant="outline"
									className={`border font-medium ${status.badgeClass}`}
								>
									{status.label}
								</Badge>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
									{status.description}
								</p>
							</div>
						</CardHeader>
						<CardContent className="flex flex-col gap-5">
							<div className="space-y-3">
								<div className="flex items-center justify-between gap-3">
									<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
										Alternativas
									</p>
									<p className="text-xs text-muted-foreground">
										{item.correctOptionIds.length > 1
											? "Questão com múltiplas respostas corretas."
											: "Questão com uma resposta correta."}
									</p>
								</div>
								<ul className="flex flex-col gap-3">
									{item.options.map((option) => {
										const isCorrectOption = correctSet.has(option.id);
										const isSelected = selectedSet.has(option.id);
										const optionStateClass = isCorrectOption
											? "border-success/20 bg-success/10"
											: isSelected
												? "border-destructive/20 bg-destructive/10"
												: "border-border/70 bg-background";

										return (
											<li
												key={option.id}
												className={`rounded-xl border px-4 py-3 ${optionStateClass}`}
											>
												<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
													<div className="flex min-w-0 gap-3">
														<span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/15 bg-background text-sm font-semibold text-foreground">
															{formatOptionKey(option.id)}
														</span>
														<p className="text-sm leading-relaxed text-foreground">
															{option.text}
														</p>
													</div>

													<div className="flex flex-wrap gap-2 sm:max-w-48 sm:justify-end">
														{isSelected ? (
															<Badge variant="secondary" className="font-medium">
																Sua escolha
															</Badge>
														) : null}
														{isCorrectOption ? (
															<Badge
																variant="outline"
																className="border-success/25 bg-success/10 font-medium text-success"
															>
																Gabarito
															</Badge>
														) : null}
														{!isSelected && !isCorrectOption ? (
															<Badge
																variant="outline"
																className="font-normal text-muted-foreground"
															>
																Não marcada
															</Badge>
														) : null}
													</div>
												</div>
											</li>
										);
									})}
								</ul>
							</div>

							<Separator />

							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-xl border border-border/70 bg-muted/30 p-4">
									<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
										Sua resposta
									</p>
									<p className="sr-only">
										Sua resposta:{" "}
										{isAnswered
											? formatLegacyOptionList(item.selectedOptionIds)
											: "—"}
									</p>
									<p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
										{isAnswered
											? formatOptionList(item.selectedOptionIds)
											: "Não respondida"}
									</p>
									<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
										{isAnswered
											? "Alternativas marcadas durante a tentativa."
											: "Você deixou esta questão em branco."}
									</p>
								</div>

								<div className="rounded-xl border border-border/70 bg-muted/30 p-4">
									<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
										Gabarito
									</p>
									<p className="sr-only">
										Resposta correta:{" "}
										{formatLegacyOptionList(item.correctOptionIds)}
									</p>
									<p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
										{formatOptionList(item.correctOptionIds)}
									</p>
									<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
										Alternativas consideradas corretas para a revisão.
									</p>
								</div>
							</div>

							{item.explanation ? (
								<div className="rounded-xl border border-border/70 bg-background p-4">
									<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
										Explicação
									</p>
									<p className="mt-3 text-sm leading-7 text-muted-foreground">
										{item.explanation}
									</p>
								</div>
							) : (
								<div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
									<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
										Explicação
									</p>
									<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
										Esta questão não trouxe uma explicação adicional.
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
