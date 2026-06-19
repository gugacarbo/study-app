import { CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ModelProbeStreamState } from "@/features/admin/hooks/use-model-probe-stream";
import { PROBE_PROMPT } from "@/functions/admin/probe-model-core";

function formatProbeJson(result: NonNullable<ModelProbeStreamState["result"]>) {
	return JSON.stringify(
		{ request: result.request, response: result.response },
		null,
		2,
	);
}

export function ModelTestStreamDialog({
	open,
	title,
	stream,
	onClose,
}: {
	open: boolean;
	title: string;
	stream: ModelProbeStreamState;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = scrollRef.current;
		if (!node) return;
		node.scrollTop = node.scrollHeight;
	}, []);

	async function handleCopy() {
		if (!stream.result) return;
		await navigator.clipboard.writeText(formatProbeJson(stream.result));
		setCopied(true);
		window.setTimeout(() => setCopied(false), 2000);
	}

	const isStreaming = stream.status === "streaming";
	const isError = stream.status === "error";
	const result = stream.result;
	const showSuccess = stream.status === "done" && result?.ok;

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="z-60 flex max-h-[85vh] flex-col sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<div className="flex min-h-0 flex-1 flex-col gap-4">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">Status</span>
						{isStreaming ? (
							<Badge variant="secondary">Gerando…</Badge>
						) : showSuccess ? (
							<Badge>Sucesso</Badge>
						) : isError || (result && !result.ok) ? (
							<Badge variant="destructive">Falha</Badge>
						) : (
							<Badge variant="secondary">Aguardando…</Badge>
						)}
					</div>
					<div
						ref={scrollRef}
						className="flex max-h-80 min-h-48 flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/20 p-3"
					>
						<div className="flex justify-end">
							<div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
								{PROBE_PROMPT}
							</div>
						</div>
						<div className="flex justify-start">
							<div className="max-w-[85%] rounded-lg border bg-background px-3 py-2 text-sm whitespace-pre-wrap">
								{stream.assistantText ? (
									stream.assistantText
								) : isStreaming ? (
									<span className="text-muted-foreground">…</span>
								) : isError && result?.response.error ? (
									<span className="text-destructive">
										{result.response.error}
									</span>
								) : (
									<span className="text-muted-foreground">
										Aguardando resposta do modelo…
									</span>
								)}
								{isStreaming ? (
									<span
										aria-hidden
										className="ml-0.5 inline-block animate-pulse"
									>
										▍
									</span>
								) : null}
							</div>
						</div>
					</div>
					{isError && result?.response.responseBody ? (
						<Alert variant="destructive">
							<AlertDescription>
								<pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
									{result.response.responseBody}
								</pre>
							</AlertDescription>
						</Alert>
					) : null}
					<div className="flex items-center justify-between gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={!result}
							onClick={handleCopy}
						>
							<CopyIcon />
							{copied ? "Copiado!" : "Copiar JSON"}
						</Button>
						<Button onClick={onClose}>Fechar</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
