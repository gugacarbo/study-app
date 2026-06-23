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
	const correctOptions = displayQuestion.options.filter((option) =>
		answerSet.has(option.key),
	);

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
						<div className="flex flex-col gap-4 pb-(--card-spacing) pt-(--card-spacing)">
							<ul className="flex flex-col gap-2" data-testid="question-options">
								{displayQuestion.options.map((option) => (
									<li
										key={option.key}
										className="text-sm text-muted-foreground"
									>
										<span className="font-medium text-foreground">
											{formatOptionKey(option.key)})
										</span>{" "}
										{option.text}
									</li>
								))}
							</ul>
							<div className="rounded-md bg-muted px-3 py-2 text-sm">
								<p className="font-medium">Gabarito</p>
								{correctOptions.length > 0 ? (
									<ul className="mt-1 flex flex-col gap-1">
										{correctOptions.map((option) => (
											<li key={option.key}>
												{formatOptionKey(option.key)}){" "}
												{option.text}
											</li>
										))}
									</ul>
								) : (
									<p className="mt-1 text-muted-foreground">
										Resposta não disponível.
									</p>
								)}
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="self-start"
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
