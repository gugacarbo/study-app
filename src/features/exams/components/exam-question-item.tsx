import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { cn } from "@/lib/utils";

type ExamQuestionItemProps = {
	index: number;
	question: QuestionDetail;
};

function formatTopic(topic: string | null): string {
	return topic ?? "Geral";
}

export function ExamQuestionItem({ index, question }: ExamQuestionItemProps) {
	const [open, setOpen] = useState(false);
	const [revealed, setRevealed] = useState(false);

	const answerSet = new Set(question.answers);
	const correctOptions = question.options.filter((option) =>
		answerSet.has(option.key),
	);

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<Card>
				<CollapsibleTrigger asChild>
					<button
						type="button"
						className="flex w-full items-center justify-between gap-2 px-(--card-spacing) py-(--card-spacing) text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
					>
						<span className="font-medium">
							Q{index} · {formatTopic(question.topic)}
						</span>
						<ChevronDownIcon
							className={cn(
								"shrink-0 text-muted-foreground transition-transform",
								open && "rotate-180",
							)}
						/>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<CardHeader className="border-t pt-(--card-spacing)">
						<p className="text-sm leading-relaxed">{question.question}</p>
					</CardHeader>
					<CardContent className="flex flex-col gap-4 pb-(--card-spacing)">
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
					</CardContent>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
}
