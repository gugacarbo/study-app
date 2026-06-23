import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

type ExamQuestionItemProps = {
	index: number;
	question: QuestionDetail;
};

function formatTopic(topic: string | null): string {
	return topic ?? "Geral";
}

export function ExamQuestionItem({ index, question }: ExamQuestionItemProps) {
	const [revealed, setRevealed] = useState(false);

	const answerSet = new Set(question.answers);
	const correctOptions = question.options.filter((option) =>
		answerSet.has(option.key),
	);

	return (
		<AccordionItem
			value={question.id}
			className="rounded-xl border bg-card text-card-foreground shadow-xs [--card-spacing:--spacing(4)] px-(--card-spacing) not-last:border-b-0"
		>
			<AccordionTrigger className="gap-2 rounded-none border-none bg-transparent font-medium hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/30">
				<span>
					Q{index} · {formatTopic(question.topic)}
				</span>
			</AccordionTrigger>
			<AccordionContent className="pb-0">
				<div className="border-t pt-(--card-spacing) pb-(--card-spacing)">
					<p className="text-sm leading-relaxed">{question.question}</p>
				</div>
				<div className="flex flex-col gap-4 pb-(--card-spacing) pt-(--card-spacing)">
					<ul className="flex flex-col gap-2">
						{question.options.map((option) => (
							<li
								key={option.key}
								className="text-sm text-muted-foreground"
							>
								<span className="font-medium text-foreground">
									{option.key})
								</span>{" "}
								{option.text}
							</li>
						))}
					</ul>
					<div className="flex flex-col gap-2">
						{revealed ? (
							<div className="rounded-md bg-muted px-3 py-2 text-sm">
								<p className="font-medium">Gabarito</p>
								{correctOptions.length > 0 ? (
									<ul className="mt-1 flex flex-col gap-1">
										{correctOptions.map((option) => (
											<li key={option.key}>
												{option.key}) {option.text}
											</li>
										))}
									</ul>
								) : (
									<p className="mt-1 text-muted-foreground">
										Resposta não disponível.
									</p>
								)}
							</div>
						) : (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="self-start"
								onClick={() => setRevealed(true)}
							>
								Revelar resposta
							</Button>
						)}
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}
