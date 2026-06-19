import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";

type JobEventsPanelProps = {
	events: JobEventRecord[];
	isLoading: boolean;
};

function formatEventTimestamp(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("pt-BR");
}

export function JobEventsPanel({ events, isLoading }: JobEventsPanelProps) {
	return (
		<section
			aria-label="Eventos do job"
			className="flex min-h-0 flex-col gap-3 rounded-lg border bg-card p-4"
		>
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-sm font-medium">Eventos ({events.length})</h2>
				{isLoading ? (
					<span className="text-xs text-muted-foreground">Atualizando…</span>
				) : null}
			</div>

			{events.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{isLoading
						? "Carregando eventos…"
						: "Nenhum evento registrado ainda."}
				</p>
			) : (
				<ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
					{events.map((event) => (
						<li
							key={event.seq}
							className="rounded-md border bg-muted/30 p-3 text-xs"
						>
							<div className="mb-2 flex items-center justify-between gap-2 text-muted-foreground">
								<span className="font-mono">#{event.seq}</span>
								<span>{formatEventTimestamp(event.createdAt)}</span>
							</div>
							<pre className="overflow-x-auto whitespace-pre-wrap font-mono">
								{JSON.stringify(event.payload, null, 2)}
							</pre>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
