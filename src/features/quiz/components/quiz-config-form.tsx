import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { QuizConfig } from "@/features/quiz/types/quiz";

export type QuizConfigFormData = QuizConfig;

type QuizConfigFormProps = {
	availableTopics: string[];
	maxQuestions: number;
	defaultValues?: Partial<QuizConfigFormData>;
	onSubmit: (data: QuizConfigFormData) => void;
	isPending?: boolean;
};

const ALL_TOPICS_VALUE = "__all__";

export function QuizConfigForm({
	availableTopics,
	maxQuestions,
	defaultValues,
	onSubmit,
	isPending = false,
}: QuizConfigFormProps) {
	const [quantity, setQuantity] = useState<number>(
		defaultValues?.quantity ?? maxQuestions,
	);
	const [order, setOrder] = useState<QuizConfig["order"]>(
		defaultValues?.order ?? "original",
	);
	const [topicFilter, setTopicFilter] = useState<string | null>(
		defaultValues?.topicFilter ?? null,
	);
	const [revealMode, setRevealMode] = useState<QuizConfig["revealMode"]>(
		defaultValues?.revealMode ?? "after",
	);

	const hasQuestions = maxQuestions > 0;
	const quantityValue = Math.min(quantity || 0, maxQuestions);

	const topicSelectValue = topicFilter ?? ALL_TOPICS_VALUE;

	const allTopics = useMemo(
		() => [ALL_TOPICS_VALUE, ...availableTopics],
		[availableTopics],
	);

	function handleTopicChange(value: string) {
		setTopicFilter(value === ALL_TOPICS_VALUE ? null : value);
	}

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!hasQuestions) return;

		onSubmit({
			order,
			quantity: quantityValue === 0 ? maxQuestions : quantityValue,
			topicFilter,
			revealMode,
		});
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-5">
			{!hasQuestions && (
				<Alert variant="destructive">
					<AlertTitle>Prova sem questões</AlertTitle>
					<AlertDescription>
						Não há questões disponíveis para este filtro. Ajuste o tópico ou
						adicione questões à prova.
					</AlertDescription>
				</Alert>
			)}

			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
				<Field orientation="vertical">
					<FieldLabel htmlFor="quiz-quantity">Quantidade</FieldLabel>
					<FieldContent>
						<Input
							id="quiz-quantity"
							type="number"
							min={1}
							max={maxQuestions}
							value={quantityValue || ""}
							onChange={(event) =>
								setQuantity(
									Math.min(
										Number.parseInt(event.target.value || "0", 10),
										maxQuestions,
									),
								)
							}
							disabled={!hasQuestions || isPending}
						/>
						<FieldDescription>
							Máximo de {maxQuestions} questão
							{maxQuestions === 1 ? "" : "s"}
							{topicFilter ? ` em “${topicFilter}”` : ""}.
						</FieldDescription>
					</FieldContent>
				</Field>

				<Field orientation="vertical">
					<FieldLabel htmlFor="quiz-order">Ordem</FieldLabel>
					<FieldContent>
						<Select
							value={order}
							onValueChange={(value) =>
								setOrder(value as QuizConfig["order"])
							}
							disabled={!hasQuestions || isPending}
						>
							<SelectTrigger id="quiz-order" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="original">Original</SelectItem>
								<SelectItem value="random">Aleatória</SelectItem>
							</SelectContent>
						</Select>
						<FieldDescription>
							Ordem original ou aleatória com seed fixa por tentativa.
						</FieldDescription>
					</FieldContent>
				</Field>
			</div>

			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
				<Field orientation="vertical">
					<FieldLabel htmlFor="quiz-topic">Tópico</FieldLabel>
					<FieldContent>
						<Select
							value={topicSelectValue}
							onValueChange={handleTopicChange}
							disabled={isPending}
						>
							<SelectTrigger id="quiz-topic" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{allTopics.map((topic) => (
									<SelectItem key={topic} value={topic}>
										{topic === ALL_TOPICS_VALUE ? "Todos" : topic}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldDescription>
							Filtro por tópico existente na prova.
						</FieldDescription>
					</FieldContent>
				</Field>

				<Field orientation="vertical">
					<FieldLabel htmlFor="quiz-reveal">Modo de revelação</FieldLabel>
					<FieldContent>
						<Select
							value={revealMode}
							onValueChange={(value) =>
								setRevealMode(value as QuizConfig["revealMode"])
							}
							disabled={isPending}
						>
							<SelectTrigger id="quiz-reveal" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="after">Só no final</SelectItem>
								<SelectItem value="during">Após responder</SelectItem>
							</SelectContent>
						</Select>
						<FieldDescription>
							Quando revelar gabarito e explicação.
						</FieldDescription>
					</FieldContent>
				</Field>
			</div>

			<Button
				type="submit"
				disabled={!hasQuestions || isPending}
				className="self-start"
			>
				{isPending ? "Iniciando…" : "Iniciar tentativa"}
			</Button>
		</form>
	);
}
