import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { uploadIngestJobFileWithProgress } from "@/features/exams/lib/ingest-api";
import { cn } from "@/lib/utils";

export type IngestUploadPanelProps = {
	jobId: string;
	pendingFile?: File;
	onUploadComplete?: () => void;
};

type UploadUiState = "idle" | "uploading" | "failed";

function UploadProgressBar({ value }: { value: number }) {
	return (
		<div
			role="progressbar"
			aria-valuenow={value}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label="Progresso do envio"
			className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20"
		>
			<div
				className={cn(
					"h-full rounded-full bg-primary transition-[width] duration-200",
				)}
				style={{ width: `${value}%` }}
			/>
		</div>
	);
}

export function IngestUploadPanel({
	jobId,
	pendingFile,
	onUploadComplete,
}: IngestUploadPanelProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uiState, setUiState] = useState<UploadUiState>("idle");
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const autoUploadStarted = useRef(false);
	const activeFileRef = useRef<File | null>(null);

	const uploadFile = useCallback(
		async (file: File) => {
			activeFileRef.current = file;
			setUiState("uploading");
			setError(null);
			setProgress(0);

			try {
				await uploadIngestJobFileWithProgress(jobId, file, setProgress);
				onUploadComplete?.();
			} catch (uploadError) {
				setUiState("failed");
				setError(
					uploadError instanceof Error
						? uploadError.message
						: "Erro desconhecido ao enviar o arquivo.",
				);
			}
		},
		[jobId, onUploadComplete],
	);

	useEffect(() => {
		if (!pendingFile || autoUploadStarted.current) return;
		autoUploadStarted.current = true;
		setSelectedFile(pendingFile);
		void uploadFile(pendingFile);
	}, [pendingFile, uploadFile]);

	const canSubmit =
		selectedFile != null && uiState !== "uploading" && uiState !== "failed";

	async function handleManualSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedFile || uiState === "uploading") return;
		await uploadFile(selectedFile);
	}

	function handleRetry() {
		const file = activeFileRef.current ?? selectedFile ?? pendingFile ?? null;
		if (!file) {
			setUiState("idle");
			setError(null);
			return;
		}
		void uploadFile(file);
	}

	function handlePickNewFile() {
		setSelectedFile(null);
		activeFileRef.current = null;
		setUiState("idle");
		setError(null);
		setProgress(0);
		autoUploadStarted.current = false;
	}

	const displayFile =
		activeFileRef.current ?? selectedFile ?? pendingFile ?? null;
	const isUploading = uiState === "uploading";

	return (
		<section
			aria-label="Envio de arquivo"
			className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-lg border bg-card p-6"
		>
			<div className="space-y-1">
				<h2 className="text-lg font-medium">Enviar arquivo da prova</h2>
				<p className="text-sm text-muted-foreground">
					Selecione o arquivo .txt ou .md para iniciar a extração de questões.
				</p>
			</div>

			{isUploading && displayFile ? (
				<div className="space-y-3">
					<p className="text-sm font-medium">{displayFile.name}</p>
					<UploadProgressBar value={progress} />
					<p className="text-sm text-muted-foreground">
						Enviando… {progress}%
					</p>
				</div>
			) : (
				<form className="space-y-4" onSubmit={(e) => void handleManualSubmit(e)}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="job-ingest-file">Arquivo</FieldLabel>
							<Input
								id="job-ingest-file"
								type="file"
								accept=".txt,.md,text/plain,text/markdown"
								disabled={isUploading}
								onChange={(event) => {
									setSelectedFile(event.target.files?.[0] ?? null);
									setUiState("idle");
									setError(null);
								}}
							/>
							<FieldDescription>
								Formatos .txt ou .md, até 512 KB e 10.000 caracteres.
							</FieldDescription>
						</Field>
					</FieldGroup>

					<Button type="submit" disabled={!canSubmit} className="w-full">
						Enviar arquivo
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
					<Button type="button" onClick={() => void handleRetry()}>
						Tentar novamente
					</Button>
					<Button type="button" variant="outline" onClick={handlePickNewFile}>
						Escolher outro arquivo
					</Button>
				</div>
			) : null}
		</section>
	);
}
