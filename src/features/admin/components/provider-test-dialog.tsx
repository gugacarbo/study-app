import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ProviderRow } from "@/features/admin/components/providers-table";

export type ProviderTestResult = {
	ok: boolean;
	providerId: string;
	providerName: string;
	baseUrl: string;
	statusCode?: number;
	latencyMs?: number;
	models?: string[];
	error?: string;
};

type ProviderTestDialogProps = {
	provider: ProviderRow | null;
	result: ProviderTestResult | null;
	busy: boolean;
	onClose: () => void;
	onRetry?: () => void;
};

function StatusBadge({ ok, statusCode }: { ok: boolean; statusCode?: number }) {
	if (!ok) {
		return <Badge variant="destructive">Falha</Badge>;
	}
	return (
		<Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
			{statusCode ? `OK · ${statusCode}` : "OK"}
		</Badge>
	);
}

export function ProviderTestDialog({
	provider,
	result,
	busy,
	onClose,
	onRetry,
}: ProviderTestDialogProps) {
	const [elapsed, setElapsed] = useState(0);
	const open = provider !== null;

	useEffect(() => {
		if (!open || !busy) {
			setElapsed(0);
			return;
		}
		const start = Date.now();
		const timer = setInterval(() => {
			setElapsed(Math.round(Date.now() - start));
		}, 100);
		return () => clearInterval(timer);
	}, [open, busy]);

	const models = result?.models ?? [];

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle>Testar provider</DialogTitle>
					<p className="text-sm text-muted-foreground">
						Resultado em tempo real da conexão com o provider.
					</p>
				</DialogHeader>

				{provider ? (
					<div className="space-y-4 py-2">
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<span className="font-medium">{provider.name}</span>
							<span className="text-muted-foreground truncate max-w-[16rem]">
								{provider.baseUrl}
							</span>
							{busy ? (
								<Badge variant="outline">Testando… {elapsed}ms</Badge>
							) : result ? (
								<StatusBadge ok={result.ok} statusCode={result.statusCode} />
							) : null}
						</div>

						{busy && !result ? (
							<div className="space-y-2 rounded-lg border p-4">
								<div className="h-2 w-1/3 animate-pulse rounded bg-muted" />
								<div className="h-2 w-2/3 animate-pulse rounded bg-muted" />
								<div className="h-2 w-1/2 animate-pulse rounded bg-muted" />
								<p className="text-xs text-muted-foreground">
									Aguardando resposta do provider…
								</p>
							</div>
						) : null}

						{result ? (
							<>
								{!result.ok ? (
									<Alert variant="destructive">
										<AlertTitle>Conexão falhou</AlertTitle>
										<AlertDescription>
											{result.error ?? "Erro desconhecido"}
										</AlertDescription>
									</Alert>
								) : (
									<Alert>
										<AlertTitle>Conexão OK</AlertTitle>
										<AlertDescription>
											{result.statusCode ? `HTTP ${result.statusCode}` : ""}
											{result.statusCode && result.latencyMs ? " · " : ""}
											{result.latencyMs ? `${result.latencyMs}ms` : ""}
											{models.length > 0
												? ` · ${models.length} modelo${models.length === 1 ? "" : "s"} detectado${models.length === 1 ? "" : "s"}`
												: ""}
										</AlertDescription>
									</Alert>
								)}

								{models.length > 0 ? (
									<div className="rounded-lg border">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead className="w-full">
														Modelos detectados
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody className="max-h-64 overflow-auto">
												{models.map((model) => (
													<TableRow key={model}>
														<TableCell className="font-mono text-xs">
															{model}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								) : null}
							</>
						) : null}

						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={onClose}>
								Fechar
							</Button>
							{onRetry ? (
								<Button onClick={onRetry} disabled={busy}>
									{busy ? "Testando…" : "Testar novamente"}
								</Button>
							) : null}
						</div>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
