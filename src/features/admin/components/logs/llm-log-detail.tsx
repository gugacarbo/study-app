"use client";

import { LogsDetailSheet, type DetailField } from "./logs-detail-sheet";

export type LlmLogDetailProps = {
	log: Record<string, unknown> | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isLoading?: boolean;
};

const STATUS_BADGE: Record<
	string,
	{ label: string; variant: "success" | "error" | "warning" }
> = {
	success: { label: "Sucesso", variant: "success" },
	error: { label: "Erro", variant: "error" },
	pending: { label: "Pendente", variant: "warning" },
};

export function LlmLogDetail({
	log,
	open,
	onOpenChange,
	isLoading,
}: LlmLogDetailProps) {
	function buildFields(): DetailField[] {
		if (!log) return [];

		return [
			{
				key: "status",
				label: "Status",
				type: "badge",
				badgeVariant: STATUS_BADGE[String(log.status)]?.variant ?? "default",
			},
			{ key: "callId", label: "Call ID" },
			{
				key: "providerModel",
				label: "Provider + Model",
				render: () => `${String(log.provider ?? "")} / ${String(log.model ?? "")}`,
			},
			{ key: "callType", label: "Call Type" },
			{ key: "baseUrl", label: "Base URL" },
			{
				key: "durationMs",
				label: "Duração",
				render: (v) => {
					if (v == null) return <span className="text-muted-foreground">—</span>;
					return <span>{Number(v)}ms</span>;
				},
			},
			{
				key: "inputTokens",
				label: "Input tokens",
				render: (v) =>
					v != null ? (
						<span className="tabular-nums">
							{Number(v).toLocaleString("pt-BR")}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					),
			},
			{
				key: "outputTokens",
				label: "Output tokens",
				render: (v) =>
					v != null ? (
						<span className="tabular-nums">
							{Number(v).toLocaleString("pt-BR")}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					),
			},
			{
				key: "totalTokens",
				label: "Total tokens",
				render: (v) =>
					v != null ? (
						<span className="tabular-nums">
							{Number(v).toLocaleString("pt-BR")}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					),
			},
			{
				key: "cost",
				label: "Custo estimado",
				render: (v) =>
					v != null ? (
						<span className="tabular-nums">
							{`US$ ${Number(v).toLocaleString("en-US", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 6,
							})}`}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					),
			},
			{ key: "chunks", label: "Chunks" },
			{ key: "finalChars", label: "Final chars" },
			{
				key: "tokenMeta",
				label: "Token meta (raw)",
				type: "code",
				render: (v) => {
					if (v == null) return <span className="text-muted-foreground">—</span>;
					try {
						const parsed = typeof v === "string" ? JSON.parse(v) : v;
						return (
							<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
								<code>{JSON.stringify(parsed, null, 2)}</code>
							</pre>
						);
					} catch {
						return (
							<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
								<code>{String(v)}</code>
							</pre>
						);
					}
				},
			},
			{ key: "systemPrompt", label: "System Prompt", type: "code" },
			{ key: "requestPayload", label: "Request Payload", type: "code" },
			{ key: "responsePayload", label: "Response Payload", type: "code" },
			{
				key: "errorMessage",
				label: "Error Message",
				render: (v) => {
					if (v == null) return <span className="text-muted-foreground">—</span>;
					return (
						<pre className="overflow-x-auto rounded-md bg-destructive/10 p-3 text-xs text-destructive">
							<code>{String(v)}</code>
						</pre>
					);
				},
			},
			{
				key: "createdAt",
				label: "Created At",
				render: (v) => {
					if (v == null) return <span className="text-muted-foreground">—</span>;
					return (
						<span>
							{new Date(String(v)).toLocaleString("pt-BR", {
								day: "2-digit",
								month: "2-digit",
								year: "numeric",
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
							})}
						</span>
					);
				},
			},
		];
	}

	return (
		<LogsDetailSheet
			open={open}
			onOpenChange={onOpenChange}
			title={log?.callId ? `Log #${String(log.callId)}` : "Detalhes do Log"}
			fields={buildFields()}
			data={log}
			isLoading={isLoading}
		/>
	);
}
