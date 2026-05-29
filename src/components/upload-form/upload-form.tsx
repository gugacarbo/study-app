import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ingestStream } from "../../lib/sse-stream";
import { getConfig } from "../../server-functions/config";
import { UploadStatus } from "./upload-status";

export function UploadForm({ onSuccess }: { onSuccess?: () => void }) {
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const [status, setStatus] = useState<
		"idle" | "uploading" | "success" | "error"
	>("idle");
	const [message, setMessage] = useState("");
	const [stepText, setStepText] = useState("");
	const [streamText, setStreamText] = useState("");
	const [totalTokens, setTotalTokens] = useState(0);
	const streamEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!streamText) return;
		if (streamEndRef.current) {
			streamEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [streamText]);
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!file) return;

		setStatus("uploading");
		setMessage("");
		setStepText("Carregando configuração da IA...");
		setStreamText("");
		setTotalTokens(0);

		try {
			const config = await getConfig();
			setStepText("Lendo arquivo...");
			const buffer = await file.arrayBuffer();
			setStepText("Enviando arquivo para processamento...");
			const result = await ingestStream(
				{
					buffer: Array.from(new Uint8Array(buffer)),
					fileName: file.name,
					config,
				},
				{
					onStep: setStepText,
					onChunk: (text) => {
						setStreamText(text);
						const estimated = Math.round(text.length / 4);
						setTotalTokens((prev) => Math.max(prev, estimated));
					},
					onToken: (_p, _c, total) =>
						setTotalTokens((prev) => Math.max(prev, total)),
				},
			);
			setStatus("success");
			setStepText("Concluído");
			setMessage(
				`Extracted ${result.questions} questions from ${result.topics.join(", ")}`,
			);
			queryClient.invalidateQueries({ queryKey: ["exams"] });
			queryClient.invalidateQueries({ queryKey: ["exams-detailed"] });
			queryClient.invalidateQueries({ queryKey: ["stats"] });
			onSuccess?.();
		} catch (err) {
			setStatus("error");
			setStepText("");
			setStreamText("");
			setMessage(err instanceof Error ? err.message : "Unknown error");
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Upload Exam</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<div className="mb-4">
						<input
							type="file"
							id="file-upload"
							accept=".pdf,.txt,.md"
							onChange={(e) => {
								const selected = e.target.files?.[0] || null;
								setFile(selected);
								if (selected) {
									setStatus("idle");
									setMessage("");
									setStepText("");
									setStreamText("");
									setTotalTokens(0);
								}
							}}
							className="hidden"
						/>
						<Button asChild variant="outline" className="w-full cursor-pointer">
							<label htmlFor="file-upload">
								{file ? file.name : "Select a file..."}
							</label>
						</Button>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={status === "uploading" || !file}
					>
						{status === "uploading" ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Processing...
							</>
						) : (
							"Upload & Extract Questions"
						)}
					</Button>
				</form>

				{status === "uploading" && (
					<UploadStatus
						stepText={stepText}
						streamText={streamText}
						totalTokens={totalTokens}
						streamEndRef={streamEndRef}
					/>
				)}

				{status !== "idle" && status !== "uploading" && (
					<div
						className={cn(
							"mt-4 p-3 rounded",
							status === "success"
								? "bg-emerald-500/10 text-emerald-600"
								: "bg-destructive/10 text-destructive",
						)}
					>
						{message}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
