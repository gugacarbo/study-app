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
import { useIngestJob } from "@/features/exams/hooks/use-ingest-job";

export function IngestUploadForm() {
	const [file, setFile] = useState<File | null>(null);
	const { uiState, error, submit, reset, isBusy } = useIngestJob();

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

	return (
		<div className="space-y-4">
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
							}}
						/>
						<FieldDescription>
							Formatos .txt ou .md, até 512 KB e 10.000 caracteres. O nome da
							prova será inferido do arquivo enviado.
						</FieldDescription>
					</Field>
				</FieldGroup>

				<Button type="submit" disabled={!canSubmit} className="w-full">
					{uiState === "uploading" ? "Enviando…" : "Importar prova"}
				</Button>
			</form>

			{uiState === "failed" && error ? (
				<Alert variant="destructive">
					<AlertTitle>Falha no envio</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{uiState === "failed" ? (
				<Button type="button" variant="outline" onClick={handleReset}>
					Tentar novamente
				</Button>
			) : null}
		</div>
	);
}
