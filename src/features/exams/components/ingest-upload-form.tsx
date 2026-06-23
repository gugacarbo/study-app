import { useState } from "react";
import { UploadProgress } from "@/components/upload-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useIngestJob } from "@/features/exams/hooks/use-ingest-job";

export function IngestUploadForm() {
	const [file, setFile] = useState<File | null>(null);
	const { uiState, progress, error, submit, reset, isBusy } = useIngestJob();

	const canSubmit = file != null && !isBusy;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!file || !canSubmit) return;

		await submit({ file });
	}

	function handleReset() {
		setFile(null);
		reset();
	}

	function handleRetry() {
		if (!file) {
			reset();
			return;
		}
		void submit({ file });
	}

	const isUploading = uiState === "uploading";

	return (
		<div className="space-y-4">
			{isUploading && file ? (
				<UploadProgress fileName={file.name} progress={progress} />
			) : (
				<form className="space-y-4" onSubmit={handleSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="ingest-file">Arquivo</FieldLabel>
							<Input
								id="ingest-file"
								type="file"
								accept=".txt,.md,text/plain,text/markdown"
								disabled={isBusy}
								onChange={(event) => {
									setFile(event.target.files?.[0] ?? null);
									reset();
								}}
							/>
							<FieldDescription>
								Formatos .txt ou .md, até 512 KB e 50.000 caracteres. O nome da
								prova será inferido do arquivo enviado.
							</FieldDescription>
						</Field>
					</FieldGroup>

					<Button type="submit" disabled={!canSubmit} className="w-full">
						{uiState === "creating" ? "Criando importação…" : "Importar prova"}
					</Button>
				</form>
			)}

			{uiState === "failed" && error ? (
				<Alert variant="destructive">
					<AlertTitle>Falha no envio</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{uiState === "failed" ? (
				<div className="flex flex-wrap gap-2">
					<Button type="button" onClick={handleRetry} disabled={file == null}>
						Tentar novamente
					</Button>
					<Button type="button" variant="outline" onClick={handleReset}>
						Escolher outro arquivo
					</Button>
				</div>
			) : null}
		</div>
	);
}
