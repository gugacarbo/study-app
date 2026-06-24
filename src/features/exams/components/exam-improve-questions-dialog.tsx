import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useImproveQuestionsJob } from "@/features/exams/hooks/use-improve-questions-job";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

type ExamImproveQuestionsDialogProps = {
	examId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	questions: QuestionDetail[];
};

export function ExamImproveQuestionsDialog({
	examId,
	open,
	onOpenChange,
	questions,
}: ExamImproveQuestionsDialogProps) {
	const improveJob = useImproveQuestionsJob();
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const allIds = useMemo(() => questions.map((question) => question.id), [questions]);
	const effectiveSelectedIds = selectedIds.length > 0 ? selectedIds : allIds;

	function toggleQuestion(questionId: string, checked: boolean) {
		setSelectedIds((prev) => {
			const base = prev.length > 0 ? prev : allIds;
			if (checked) {
				return Array.from(new Set([...base, questionId]));
			}
			return base.filter((id) => id !== questionId);
		});
	}

	function selectAll() {
		setSelectedIds(allIds);
	}

	async function handleSubmit() {
		if (effectiveSelectedIds.length === 0) return;
		await improveJob.submit({
			examId,
			questionIds: effectiveSelectedIds,
		});
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl h-128 flex flex-col">
				<DialogHeader>
					<DialogTitle>Melhorar questões</DialogTitle>
					<DialogDescription>
						Selecione as questões que devem entrar no lote de melhoria.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						{effectiveSelectedIds.length} de {questions.length} selecionada(s)
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							if (effectiveSelectedIds.length === questions.length) {
								setSelectedIds([]);
							} else {
								selectAll();
							}
						}}
					>
						{effectiveSelectedIds.length === questions.length
							? "Desmarcar todas"
							: "Selecionar todas"}
					</Button>
				</div>

				<div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
					{questions.map((question, index) => {
						const checked = effectiveSelectedIds.includes(question.id);
						return (
							<label
								key={question.id}
								className="flex items-start gap-3 rounded-lg border p-3"
							>
								<Checkbox
									checked={checked}
									onCheckedChange={(value) =>
										toggleQuestion(question.id, value === true)
									}
									aria-label={`Selecionar questão ${index + 1}`}
								/>
								<div className="space-y-1">
									<p className="text-sm font-medium">
										Q{index + 1} · {question.topic ?? "Geral"}
									</p>
									<p className="text-sm text-muted-foreground">
										{question.question}
									</p>
								</div>
							</label>
						);
					})}
				</div>

				{improveJob.error ? (
					<p className="text-sm text-destructive">{improveJob.error}</p>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						onClick={() => void handleSubmit()}
						disabled={improveJob.isPending || effectiveSelectedIds.length === 0}
					>
						{improveJob.isPending ? "Iniciando…" : "Iniciar melhoria"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
