import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
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
import { Textarea } from "@/components/ui/textarea";
import { UploadProgress } from "@/components/upload-progress";
import { useGenerateExamJob } from "@/features/exams/hooks/use-generate-exam-job";
import type { GenerateExamDifficulty } from "@/features/exams/lib/generate-exam-api";
import { deriveExamNameFromFilename } from "@/lib/derive-exam-name";
import { MAX_TEXT_CHARS } from "@/lib/ingest-limits";

type FormErrors = {
	title?: string;
	mainContent?: string;
	questionCount?: string;
	difficultyNotes?: string;
	contextFiles?: string;
};

const MAX_CONTEXT_FILES = 5;
const MAX_TITLE_LENGTH = 120;
const MAX_DIFFICULTY_NOTES_LENGTH = 2000;
const textDecoder = new TextDecoder("utf-8");

const DIFFICULTY_OPTIONS: Array<{
	value: GenerateExamDifficulty;
	label: string;
}> = [
	{ value: "easy", label: "Fácil" },
	{ value: "medium", label: "Médio" },
	{ value: "hard", label: "Difícil" },
];

function getSuggestedTitle(mainContent: string, contextFiles: File[]): string {
	const headingMatch = mainContent.match(/^#{1,6}\s+(.+?)\s*$/m);
	if (headingMatch?.[1]) {
		return headingMatch[1].trim().slice(0, MAX_TITLE_LENGTH);
	}

	const firstNonEmptyLine = mainContent
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0);
	if (firstNonEmptyLine) {
		return firstNonEmptyLine.slice(0, MAX_TITLE_LENGTH);
	}

	if (contextFiles[0]) {
		return deriveExamNameFromFilename(contextFiles[0].name).slice(
			0,
			MAX_TITLE_LENGTH,
		);
	}

	return "Nova prova";
}

type ContextFileValidationResult = {
	error?: string;
	totalChars: number;
};

function validateSelectedFiles(files: File[]): string | undefined {
	if (files.length > MAX_CONTEXT_FILES) {
		return `Voce pode anexar ate ${MAX_CONTEXT_FILES} arquivos de contexto.`;
	}

	for (const file of files) {
		const fileName = file.name.toLowerCase();
		if (!fileName.endsWith(".txt") && !fileName.endsWith(".md")) {
			return "Anexe apenas arquivos .txt ou .md.";
		}
	}

	return undefined;
}

async function validateContextPayload(
	mainContent: string,
	files: File[],
): Promise<ContextFileValidationResult> {
	const extensionError = validateSelectedFiles(files);
	if (extensionError) {
		return { error: extensionError, totalChars: mainContent.length };
	}

	let totalChars = mainContent.length;
	for (const file of files) {
		const text = textDecoder.decode(await file.arrayBuffer());
		if (text.trim().length === 0) {
			return {
				error: `O arquivo ${file.name} esta vazio.`,
				totalChars,
			};
		}
		totalChars += text.length;
		if (totalChars > MAX_TEXT_CHARS) {
			return {
				error: `O conteudo principal e os anexos excedem o limite de ${MAX_TEXT_CHARS.toLocaleString("pt-BR")} caracteres.`,
				totalChars,
			};
		}
	}

	return { totalChars };
}

export function GenerateExamForm() {
	const generateJob = useGenerateExamJob();
	const [title, setTitle] = useState("");
	const [mainContent, setMainContent] = useState("");
	const [questionCount, setQuestionCount] = useState(10);
	const [difficulty, setDifficulty] =
		useState<GenerateExamDifficulty>("medium");
	const [difficultyNotes, setDifficultyNotes] = useState("");
	const [contextFiles, setContextFiles] = useState<File[]>([]);
	const [titleEditedManually, setTitleEditedManually] = useState(false);
	const [errors, setErrors] = useState<FormErrors>({});
	const [validatedTotalChars, setValidatedTotalChars] = useState<number | null>(
		null,
	);

	useEffect(() => {
		if (titleEditedManually) {
			return;
		}

		if (mainContent.trim().length === 0 && contextFiles.length === 0) {
			setTitle("");
			return;
		}

		setTitle(getSuggestedTitle(mainContent, contextFiles));
	}, [contextFiles, mainContent, titleEditedManually]);

	const fileError = useMemo(
		() => validateSelectedFiles(contextFiles),
		[contextFiles],
	);

	const totalTextLength = useMemo(() => {
		return validatedTotalChars ?? mainContent.length;
	}, [mainContent, validatedTotalChars]);

	const canSubmit = !generateJob.isBusy;
	const uploadLabel = useMemo(() => {
		if (contextFiles.length === 0) {
			return "Conteudo base";
		}

		if (contextFiles.length === 1) {
			return `Conteudo base + ${contextFiles[0]?.name ?? "1 anexo"}`;
		}

		return `Conteudo base + ${contextFiles.length} anexos`;
	}, [contextFiles]);

	function resetForm() {
		setTitle("");
		setMainContent("");
		setQuestionCount(10);
		setDifficulty("medium");
		setDifficultyNotes("");
		setContextFiles([]);
		setTitleEditedManually(false);
		setErrors({});
		setValidatedTotalChars(null);
		generateJob.reset();
	}

	function handleFileChange(files: FileList | null) {
		const nextFiles = files ? Array.from(files) : [];
		setContextFiles(nextFiles);
		setErrors((prev) => ({
			...prev,
			contextFiles: undefined,
		}));
		setValidatedTotalChars(null);
		generateJob.reset();
	}

	function validateForm(): FormErrors {
		const nextErrors: FormErrors = {};
		const trimmedTitle = title.trim();
		const trimmedMainContent = mainContent.trim();
		const trimmedDifficultyNotes = difficultyNotes.trim();

		if (trimmedTitle.length === 0) {
			nextErrors.title = "Informe um titulo para a prova.";
		} else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
			nextErrors.title = `O titulo deve ter no maximo ${MAX_TITLE_LENGTH} caracteres.`;
		}

		if (trimmedMainContent.length === 0) {
			nextErrors.mainContent = "Descreva o conteudo base da prova.";
		}

		if (
			!Number.isInteger(questionCount) ||
			questionCount < 1 ||
			questionCount > 20
		) {
			nextErrors.questionCount = "Escolha entre 1 e 20 questoes.";
		}

		if (trimmedDifficultyNotes.length > MAX_DIFFICULTY_NOTES_LENGTH) {
			nextErrors.difficultyNotes = `As instrucoes complementares devem ter no maximo ${MAX_DIFFICULTY_NOTES_LENGTH} caracteres.`;
		}

		const selectedFilesError = validateSelectedFiles(contextFiles);
		if (selectedFilesError) {
			nextErrors.contextFiles = selectedFilesError;
		}

		return nextErrors;
	}

	async function submitForm() {
		const nextErrors = validateForm();
		setErrors(nextErrors);

		if (Object.keys(nextErrors).length > 0 || !canSubmit) {
			return;
		}

		const contextValidation = await validateContextPayload(
			mainContent,
			contextFiles,
		);
		setValidatedTotalChars(contextValidation.totalChars);
		if (contextValidation.error) {
			setErrors((prev) => ({
				...prev,
				contextFiles: contextValidation.error,
			}));
			return;
		}

		await generateJob.submit({
			title: title.trim(),
			mainContent: mainContent.trim(),
			questionCount,
			difficulty,
			difficultyNotes: difficultyNotes.trim() || undefined,
			contextFiles,
		});
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		await submitForm();
	}

	const isUploading = generateJob.uiState === "uploading";

	return (
		<div className="space-y-4">
			{isUploading ? (
				<UploadProgress
					fileName={uploadLabel}
					progress={generateJob.progress}
				/>
			) : (
				<form className="space-y-5" onSubmit={handleSubmit}>
					<FieldGroup>
						<Field orientation="vertical">
							<FieldLabel htmlFor="generate-exam-title">Titulo</FieldLabel>
							<FieldContent>
								<Input
									id="generate-exam-title"
									value={title}
									maxLength={MAX_TITLE_LENGTH}
									disabled={generateJob.isBusy}
									onChange={(event) => {
										setTitle(event.target.value);
										setTitleEditedManually(true);
										setErrors((prev) => ({ ...prev, title: undefined }));
									}}
								/>
								<FieldDescription>
									Sugerido automaticamente a partir do conteudo ou do primeiro
									anexo, sem sobrescrever sua edicao manual.
								</FieldDescription>
								<FieldError>{errors.title}</FieldError>
							</FieldContent>
						</Field>

						<Field orientation="vertical">
							<FieldLabel htmlFor="generate-exam-main-content">
								Conteudo principal
							</FieldLabel>
							<FieldContent>
								<Textarea
									id="generate-exam-main-content"
									value={mainContent}
									disabled={generateJob.isBusy}
									className="min-h-48"
									onChange={(event) => {
										setMainContent(event.target.value);
										setErrors((prev) => ({
											...prev,
											mainContent: undefined,
										}));
										generateJob.reset();
									}}
									placeholder="Cole aqui o conteudo base, topicos, objetivos ou trechos que devem orientar a geracao das questoes."
								/>
								<FieldDescription>
									Use markdown, texto livre ou um resumo estruturado do conteudo
									que deve virar prova.
								</FieldDescription>
								<FieldError>{errors.mainContent}</FieldError>
							</FieldContent>
						</Field>

						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<Field orientation="vertical">
								<FieldLabel htmlFor="generate-exam-question-count">
									Quantidade de questoes
								</FieldLabel>
								<FieldContent>
									<Input
										id="generate-exam-question-count"
										type="number"
										min={1}
										max={20}
										value={questionCount}
										disabled={generateJob.isBusy}
										onChange={(event) => {
											const parsed = Number.parseInt(event.target.value, 10);
											setQuestionCount(
												Number.isNaN(parsed)
													? 1
													: Math.min(20, Math.max(1, parsed)),
											);
											setErrors((prev) => ({
												...prev,
												questionCount: undefined,
											}));
										}}
									/>
									<FieldDescription>
										Escolha entre 1 e 20 questoes objetivas.
									</FieldDescription>
									<FieldError>{errors.questionCount}</FieldError>
								</FieldContent>
							</Field>

							<Field orientation="vertical">
								<FieldLabel htmlFor="generate-exam-difficulty">
									Dificuldade
								</FieldLabel>
								<FieldContent>
									<Select
										value={difficulty}
										onValueChange={(value) =>
											setDifficulty(value as GenerateExamDifficulty)
										}
										disabled={generateJob.isBusy}
									>
										<SelectTrigger
											id="generate-exam-difficulty"
											className="w-full"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DIFFICULTY_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldDescription>
										Define o nivel esperado das questoes geradas.
									</FieldDescription>
								</FieldContent>
							</Field>
						</div>

						<Field orientation="vertical">
							<FieldLabel htmlFor="generate-exam-difficulty-notes">
								Instrucoes complementares
							</FieldLabel>
							<FieldContent>
								<Textarea
									id="generate-exam-difficulty-notes"
									value={difficultyNotes}
									maxLength={MAX_DIFFICULTY_NOTES_LENGTH}
									disabled={generateJob.isBusy}
									className="min-h-28"
									onChange={(event) => {
										setDifficultyNotes(event.target.value);
										setErrors((prev) => ({
											...prev,
											difficultyNotes: undefined,
										}));
									}}
									placeholder="Opcional: destaque foco da banca, profundidade desejada, topicos prioritarios ou restricoes."
								/>
								<FieldDescription>
									Ajuda a calibrar a dificuldade ou orientar recortes mais
									especificos.
								</FieldDescription>
								<FieldError>{errors.difficultyNotes}</FieldError>
							</FieldContent>
						</Field>

						<Field orientation="vertical">
							<FieldLabel htmlFor="generate-exam-context-files">
								Arquivos de contexto
							</FieldLabel>
							<FieldContent>
								<Input
									id="generate-exam-context-files"
									type="file"
									multiple
									accept=".txt,.md,text/plain,text/markdown"
									disabled={generateJob.isBusy}
									onChange={(event) => {
										handleFileChange(event.target.files);
									}}
								/>
								<FieldDescription>
									Anexe ate {MAX_CONTEXT_FILES} arquivos .txt ou .md para
									complementar o conteudo principal.
								</FieldDescription>
								<FieldError>{errors.contextFiles ?? fileError}</FieldError>
							</FieldContent>
						</Field>

						{contextFiles.length > 0 ? (
							<div className="rounded-lg border px-3 py-3">
								<p className="text-sm font-medium">Anexos selecionados</p>
								<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
									{contextFiles.map((file) => (
										<li key={`${file.name}-${file.size}`}>{file.name}</li>
									))}
								</ul>
							</div>
						) : null}

						<p className="text-sm text-muted-foreground">
							Limite compartilhado de ate{" "}
							{MAX_TEXT_CHARS.toLocaleString("pt-BR")} caracteres entre o
							conteudo principal e os anexos. Estimativa local atual:{" "}
							{totalTextLength.toLocaleString("pt-BR")}.
						</p>
					</FieldGroup>

					<Button type="submit" disabled={!canSubmit || !!fileError}>
						{generateJob.uiState === "creating"
							? "Criando geracao..."
							: "Gerar prova com IA"}
					</Button>
				</form>
			)}

			{generateJob.uiState === "failed" && generateJob.error ? (
				<Alert variant="destructive">
					<AlertTitle>Falha ao iniciar a geracao</AlertTitle>
					<AlertDescription>{generateJob.error}</AlertDescription>
				</Alert>
			) : null}

			{generateJob.uiState === "failed" ? (
				<div className="flex flex-wrap gap-2">
					<Button type="button" onClick={() => void submitForm()}>
						Tentar novamente
					</Button>
					<Button type="button" variant="outline" onClick={resetForm}>
						Limpar formulario
					</Button>
				</div>
			) : null}
		</div>
	);
}
