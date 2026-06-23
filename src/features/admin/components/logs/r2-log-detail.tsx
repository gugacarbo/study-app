"use client";

import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
	LogsDetailSheet,
	type DetailField,
} from "@/features/admin/components/logs/logs-detail-sheet";

export type R2LogDetailProps = {
	log: Record<string, unknown> | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isLoading?: boolean;
};

const OPERATION_VARIANTS: Record<string, "default" | "success" | "error" | "warning"> = {
	get: "default",
	put: "success",
	delete: "error",
	head: "warning",
	list: "warning",
};

function operationBadge(value: unknown) {
	const op = String(value ?? "");
	const variant = OPERATION_VARIANTS[op] ?? "default";
	return <Badge variant={variant === "error" ? "destructive" : variant === "success" ? "default" : variant === "warning" ? "secondary" : "default"}>{op.toUpperCase()}</Badge>;
}

function formatBytes(bytes: unknown): string {
	if (bytes == null) return "—";
	const n = Number(bytes);
	if (Number.isNaN(n)) return "—";
	if (n === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
	const value = n / Math.pow(1024, i);
	return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(value: unknown): string {
	if (!value) return "—";
	const date = new Date(String(value));
	if (Number.isNaN(date.getTime())) return String(value);
	return format(date, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

const fields: DetailField[] = [
	{
		key: "status",
		label: "Status",
		type: "badge",
		badgeVariant: "default",
		render: (value) => {
			const status = String(value ?? "");
			const variant = status === "success" ? "success" : "error";
			return <Badge variant={variant === "error" ? "destructive" : "default"}>{status}</Badge>;
		},
	},
	{ key: "bucket", label: "Bucket" },
	{
		key: "operation",
		label: "Operação",
		render: operationBadge,
	},
	{
		key: "objectKey",
		label: "Objeto",
		type: "code",
	},
	{
		key: "bytes",
		label: "Bytes",
		render: formatBytes,
	},
	{
		key: "durationMs",
		label: "Duração",
		render: (value) => (value != null ? `${value}ms` : "—"),
	},
	{
		key: "errorMessage",
		label: "Erro",
		type: "code",
		render: (value) => {
			if (!value) return <span className="text-muted-foreground">—</span>;
			return (
				<code className="overflow-x-auto rounded-md bg-destructive/10 p-1 text-xs text-destructive">
					{String(value)}
				</code>
			);
		},
	},
	{
		key: "createdAt",
		label: "Criado em",
		render: formatDate,
	},
];

export function R2LogDetail({
	log,
	open,
	onOpenChange,
	isLoading,
}: R2LogDetailProps) {
	const id = log?.id as string | undefined;
	const title = id ? `R2 Log #${id.slice(0, 8)}` : "R2 Log";

	return (
		<LogsDetailSheet
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			fields={fields}
			data={log}
			isLoading={isLoading}
		/>
	);
}
