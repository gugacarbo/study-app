import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { QuestionEditForm } from "@/features/exams/components/question-edit-form";
import { useUpdateQuestion } from "@/features/exams/hooks/use-update-question";
import type { QuestionFormInput } from "@/features/exams/lib/question-form-schema";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

type ExamQuestionItemProps = {
	index: number;
	examId: string;
	question: QuestionDetail;
};

function formatTopic(topic: string | null): string {
	return topic ?? "Geral";
}

function formatOptionKey(key: string): string {
	return key.toLowerCase();
}

export function ExamQuestionItem({
	index,
	examId,
	question,
}: ExamQuestionItemProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [displayQuestion, setDisplayQuestion] = useState(question);
	const updateQuestion = useUpdateQuestion(examId);

	const answerSet = new Set(displayQuestion.answers);

	async function handleSubmit(data: QuestionFormInput) {
		const updated = await updateQuestion.mutateAsync({
			examId,
			questionId: displayQuestion.id,
			...data,
		});
		setDisplayQuestion(updated);
		setIsEditing(false);
	}

	function handleCancel() {
		setIsEditing(false);
	}

	return (
		<AccordionItem
			value={displayQuestion.id}
			className="rounded-xl border bg-card text-card-foreground shadow-xs [--card-spacing:--spacing(4)] px-(--card-spacing) not-last:border-b-0"
		>
			<AccordionTrigger className="gap-2 rounded-none border-none bg-transparent font-medium hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/30">
				<span>
					Q{index} · {formatTopic(displayQuestion.topic)}
				</span>
			</AccordionTrigger>
			<AccordionContent className="pb-0">
				{isEditing ? (
					<div className="border-t pt-(--card-spacing) pb-(--card-spacing)">
						<QuestionEditForm
							question={displayQuestion}
							onSubmit={handleSubmit}
							onCancel={handleCancel}
							isPending={updateQuestion.isPending}
						/>
						{updateQuestion.isError && (
							<p className="mt-2 text-sm text-destructive">
								Erro ao salvar. Tente novamente.
							</p>
						)}
					</div>
				) : (
					<>
						<div className="border-t pt-(--card-spacing) pb-(--card-spacing)">
							<p className="text-sm leading-relaxed">
								{displayQuestion.question}
							</p>
						</div>
						<div className="flex flex-col gap-2 pb-(--card-spacing) pt-(--card-spacing)">
							<ul className="flex flex-col gap-1.5" data-testid="question-options">
								{displayQuestion.options.map((option) => {
									const isCorrect = answerSet.has(option.key);
									return (
										<li
											key={option.key}
											className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm ${
												isCorrect
													? "bg-primary/10 text-primary font-medium ring-1 ring-primary/25"
													: "text-muted-foreground"
											}`}
										>
											<span className="font-medium tabular-nums">
												{formatOptionKey(option.key)})
											</span>
											<span>{option.text}</span>
											{isCorrect && (
												<span className="ml-auto text-xs uppercase tracking-wider opacity-70">
													correta
												</span>
											)}
										</li>
									);
								})}
							</ul>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="mt-2 self-start"
								onClick={() => setIsEditing(true)}
							>
								Editar pergunta
							</Button>
						</div>
					</>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}