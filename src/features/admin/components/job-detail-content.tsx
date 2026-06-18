import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import type { AdminJobDetail } from "@/features/admin/hooks/use-admin-jobs";
import { formatMutationError } from "@/features/admin/lib/mutation-error";
import {
	formatJobKind,
	formatJobPhase,
	formatJobStatus,
	formatJobTimestamp,
} from "@/features/admin/lib/job-labels";
import {
	isCancellableJobStatus,
	JOB_KIND,
	type IngestJobMetadata,
} from "@/lib/job-kinds";
import type { JsonObject } from "@/lib/json-value";

type JobDetailContentProps = {
	detail: AdminJobDetail;
	onCancel: () => Promise<void>;
};

function IngestMetadataSection({ metadata }: { metadata: IngestJobMetadata }) {
	const rows: Array<[string, string]> = [
		["Exame", metadata.examId],
		["Modelo", metadata.modelId],
		["Modo", metadata.mode],
	];
	if (metadata.fileName) rows.push(["Arquivo", metadata.fileName]);
	if (metadata.extractedCount != null) {
		rows.push(["Extraídas", String(metadata.extractedCount)]);
	}
	if (metadata.persistedCount != null) {
		rows.push(["Salvas", String(metadata.persistedCount)]);
	}
	if (metadata.skippedDuplicateCount != null) {
		rows.push(["Duplicatas", String(metadata.skippedDuplicateCount)]);
	}
	if (metadata.invalidCount != null) {
		rows.push(["Inválidas", String(metadata.invalidCount)]);
	}
	if (metadata.warning) rows.push(["Aviso", metadata.warning]);

	return (
		<div className="space-y-2">
			<h3 className="text-sm font-medium">Metadata (ingest)</h3>
			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
				{rows.map(([label, value]) => (
					<div key={label} className="contents">
						<dt className="text-muted-foreground">{label}</dt>
						<dd className="break-all font-mono text-xs">{value}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

export function JobDetailContent({ detail, onCancel }: JobDetailContentProps) {
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const phaseLabel = formatJobPhase(detail.phase);
	const canCancel = isCancellableJobStatus(detail.status);
	const ingestMetadata =
		detail.kind === JOB_KIND.INGEST && detail.metadata
			? (detail.metadata as JsonObject as unknown as IngestJobMetadata)
			: null;

	async function handleCancel() {
		if (
			!window.confirm(
				"Cancelar este job? O consumer irá parar entre etapas.",
			)
		) {
			return;
		}
		setPending(true);
		setError(null);
		try {
			await onCancel();
		} catch (cause) {
			setError(await formatMutationError(cause));
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
				<dt className="text-muted-foreground">ID</dt>
				<dd className="break-all font-mono text-xs">{detail.id}</dd>
				<dt className="text-muted-foreground">Usuário</dt>
				<dd className="break-all font-mono text-xs">{detail.userId}</dd>
				<dt className="text-muted-foreground">Tipo</dt>
				<dd>{formatJobKind(detail.kind)}</dd>
				<dt className="text-muted-foreground">Status</dt>
				<dd>
					<Badge>{formatJobStatus(detail.status)}</Badge>
					{phaseLabel ? (
						<span className="ml-2 text-muted-foreground">{phaseLabel}</span>
					) : null}
				</dd>
				<dt className="text-muted-foreground">Criado</dt>
				<dd>{formatJobTimestamp(detail.createdAt)}</dd>
				<dt className="text-muted-foreground">Atualizado</dt>
				<dd>{formatJobTimestamp(detail.updatedAt)}</dd>
				{detail.cancelRequestedAt ? (
					<>
						<dt className="text-muted-foreground">Cancelamento</dt>
						<dd>{formatJobTimestamp(detail.cancelRequestedAt)}</dd>
					</>
				) : null}
				{detail.error ? (
					<>
						<dt className="text-muted-foreground">Erro</dt>
						<dd className="text-destructive">{detail.error}</dd>
					</>
				) : null}
			</dl>

			{ingestMetadata ? (
				<IngestMetadataSection metadata={ingestMetadata} />
			) : detail.metadata ? (
				<div className="space-y-2">
					<h3 className="text-sm font-medium">Metadata</h3>
					<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
						{JSON.stringify(detail.metadata, null, 2)}
					</pre>
				</div>
			) : null}

			<div className="space-y-2">
				<h3 className="text-sm font-medium">
					Eventos ({detail.events.length})
				</h3>
				{detail.events.length === 0 ? (
					<p className="text-sm text-muted-foreground">Nenhum evento.</p>
				) : (
					<ul className="space-y-3">
						{detail.events.map((event) => (
							<li
								key={event.seq}
								className="rounded-md border p-3 text-xs"
							>
								<div className="mb-1 flex items-center justify-between gap-2 text-muted-foreground">
									<span>#{event.seq}</span>
									<span>{formatJobTimestamp(event.createdAt)}</span>
								</div>
								<pre className="overflow-x-auto whitespace-pre-wrap">
									{JSON.stringify(event.payload, null, 2)}
								</pre>
							</li>
						))}
					</ul>
				)}
			</div>

			{canCancel ? (
				<SheetFooter className="px-0">
					<Button
						variant="destructive"
						disabled={pending}
						onClick={() => void handleCancel()}
					>
						{pending ? "Cancelando…" : "Cancelar job"}
					</Button>
				</SheetFooter>
			) : null}
		</div>
	);
}
