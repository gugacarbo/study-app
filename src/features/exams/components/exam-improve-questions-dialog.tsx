import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useImproveQuestionsJob } from "@/features/exams/hooks/use-improve-questions-job";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY } from "@/lib/job-kinds";

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
	const [concurrencyLimit, setConcurrencyLimit] = useState(
		IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY,
	);
	const [writeExplanations, setWriteExplanations] = useState(false);
	const [writeOptionExplanations, setWriteOptionExplanations] = useState(false);

	const allIds = useMemo(
		() => questions.map((question) => question.id),
		[questions],
	);

	useEffect(() => {
		if (!open) return;
		setSelectedIds(allIds);
		setConcurrencyLimit(IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY);
		setWriteExplanations(false);
		setWriteOptionExplanations(false);
	}, [allIds, open]);

	function toggleQuestion(questionId: string, checked: boolean) {
		setSelectedIds((prev) => {
			if (checked) {
				return Array.from(new Set([...prev, questionId]));
			}
			return prev.filter((id) => id !== questionId);
		});
	}

	function selectAll() {
		setSelectedIds(allIds);
	}

	async function handleSubmit() {
		if (selectedIds.length === 0) return;
		const ok = await improveJob.submit({
			examId,
			questionIds: selectedIds,
			concurrencyLimit,
			writeExplanations,
			writeOptionExplanations,
		});
		if (ok) {
			onOpenChange(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[min(56rem,calc(100vw-2rem))] max-w-4xl min-h-[42rem] max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Melhorar questões</DialogTitle>
					<DialogDescription>
						Selecione as questões que devem entrar no lote de melhoria.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						{selectedIds.length} de {questions.length} selecionada(s)
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							if (selectedIds.length === questions.length) {
								setSelectedIds([]);
							} else {
								selectAll();
							}
						}}
					>
						{selectedIds.length === questions.length
							? "Desmarcar todas"
							: "Selecionar todas"}
					</Button>
				</div>

				<div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
					{questions.map((question, index) => {
						const checked = selectedIds.includes(question.id);
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

				<Field orientation="vertical">
					<FieldLabel htmlFor="improve-concurrency-limit">
						Máximo de tarefas em paralelo
					</FieldLabel>
					<FieldContent>
						<Input
							id="improve-concurrency-limit"
							type="number"
							min={1}
							max={5}
							value={concurrencyLimit}
							onChange={(event) => {
								const parsed = Number.parseInt(event.target.value, 10);
								if (Number.isNaN(parsed)) {
									setConcurrencyLimit(
										IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY,
									);
									return;
								}
								setConcurrencyLimit(Math.min(5, Math.max(1, parsed)));
							}}
							disabled={improveJob.isPending}
							aria-label="Máximo de tarefas em paralelo"
						/>
						<FieldDescription>
							Define quantas questões o job pode processar ao mesmo tempo.
						</FieldDescription>
					</FieldContent>
				</Field>

				<div className="flex items-center justify-between rounded-lg border px-3 py-3">
					<div className="space-y-1">
						<p className="text-sm font-medium">
							Reescrever explicações com agente especialista
						</p>
						<p className="text-sm text-muted-foreground">
							Roda um segundo agente para sobrescrever explicações e emitir
							alertas.
						</p>
					</div>
					<Switch
						checked={writeExplanations}
						onCheckedChange={setWriteExplanations}
						aria-label="Reescrever explicações com agente especialista"
					/>
				</div>

				<div className="flex items-center justify-between rounded-lg border px-3 py-3">
					<div className="space-y-1">
						<p className="text-sm font-medium">
							Explicar alternativas incorretas
						</p>
						<p className="text-sm text-muted-foreground">
							Gera, para cada alternativa, uma explicação do porquê ela está
							incorreta (ou correta).
						</p>
					</div>
					<Switch
						checked={writeOptionExplanations}
						onCheckedChange={setWriteOptionExplanations}
						aria-label="Explicar alternativas incorretas"
					/>
				</div>

				{improveJob.error ? (
					<p className="text-sm text-destructive">{improveJob.error}</p>
				) : null}
				{improveJob.conflict ? (
					<div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm">
						<p className="text-amber-950">{improveJob.conflict.message}</p>
						<div className="flex flex-wrap gap-2">
							<Button asChild type="button" variant="outline" size="sm">
								<Link
									to="/jobs/$jobId"
									params={{ jobId: improveJob.conflict.jobId }}
								>
									Ir para o job
								</Link>
							</Button>
							<Button asChild type="button" variant="outline" size="sm">
								<Link
									to="/exams/$examId"
									params={{ examId: improveJob.conflict.examId }}
								>
									Ir para as questões
								</Link>
							</Button>
						</div>
					</div>
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
						disabled={improveJob.isPending || selectedIds.length === 0}
					>
						{improveJob.isPending ? "Iniciando…" : "Iniciar melhoria"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
