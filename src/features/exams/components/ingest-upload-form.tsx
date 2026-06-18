import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { INGEST_PHASE } from "@/lib/job-kinds";
import { useIngestJob } from "@/features/exams/hooks/use-ingest-job";

const PHASE_LABELS: Record<string, string> = {
	[INGEST_PHASE.READING_FILE]: "Lendo arquivo…",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões…",
	[INGEST_PHASE.PERSISTING]: "Salvando questões…",
};

function formatPhaseLabel(phase: string | null): string | null {
	if (!phase) return null;
	return PHASE_LABELS[phase] ?? phase;
}

export function IngestUploadForm() {
	const [name, setName] = useState("");
	const [modelId, setModelId] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const {
		uiState,
		phase,
		error,
		metadata,
		examId,
		submit,
		reset,
		isBusy,
	} = useIngestJob();

	const canSubmit = name.trim().length > 0 && file != null && !isBusy;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!file || !canSubmit) return;

		await submit({
			name: name.trim(),
			file,
			modelId: modelId.trim() || undefined,
		});
	}

	function handleReset() {
		setName("");
		setModelId("");
		setFile(null);
		reset();
	}

	return (
		<div className="space-y-4">
			<form className="space-y-4" onSubmit={handleSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="exam-name">Nome da prova</FieldLabel>
						<Input
							id="exam-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Ex.: Cálculo I — P1 2025"
							disabled={isBusy}
							required
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor="ingest-file">Arquivo</FieldLabel>
						<Input
							id="ingest-file"
							type="file"
							accept=".txt,.md,text/plain,text/markdown"
							disabled={isBusy}
							onChange={(event) => {
								setFile(event.target.files?.[0] ?? null);
							}}
						/>
						<FieldDescription>
							Formatos .txt ou .md, até 512 KB e 10.000 caracteres.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel htmlFor="model-id">Modelo (opcional)</FieldLabel>
						<Input
							id="model-id"
							value={modelId}
							onChange={(event) => setModelId(event.target.value)}
							placeholder="UUID do modelo de IA"
							disabled={isBusy}
						/>
						<FieldDescription>
							Deixe em branco para usar o modelo padrão da conta.
						</FieldDescription>
					</Field>
				</FieldGroup>

				<Button type="submit" disabled={!canSubmit} className="w-full">
					{uiState === "uploading" ? "Enviando…" : "Importar prova"}
				</Button>
			</form>

			{uiState === "processing" ? (
				<Alert>
					<AlertTitle>Processando</AlertTitle>
					<AlertDescription>
						{formatPhaseLabel(phase) ?? "Aguardando início do processamento…"}
					</AlertDescription>
				</Alert>
			) : null}

			{uiState === "done" && metadata ? (
				<Alert>
					<AlertTitle>Importação concluída</AlertTitle>
					<AlertDescription>
						<p>
							{metadata.persistedCount ?? 0} questão(ões) salva(s)
							{metadata.skippedDuplicateCount
								? `, ${metadata.skippedDuplicateCount} duplicata(s) ignorada(s)`
								: ""}
							{metadata.invalidCount
								? `, ${metadata.invalidCount} inválida(s)`
								: ""}
							.
						</p>
						{examId ? (
							<p className="mt-2 text-xs text-muted-foreground">
								Exame: {examId}
							</p>
						) : null}
					</AlertDescription>
				</Alert>
			) : null}

			{uiState === "failed" && error ? (
				<Alert variant="destructive">
					<AlertTitle>Falha na importação</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{uiState === "done" || uiState === "failed" ? (
				<Button type="button" variant="outline" onClick={handleReset}>
					Nova importação
				</Button>
			) : null}
		</div>
	);
}
