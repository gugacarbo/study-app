import type { MappedAssistantMessage } from "@/features/background-processes/lib/ingest-event-mapper";

type IngestAgentThreadProps = {
	messages: MappedAssistantMessage[];
	isRunning: boolean;
};

export function IngestAgentThread({
	messages,
	isRunning,
}: IngestAgentThreadProps) {
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
			{messages.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					Aguardando atualizações do agente…
				</p>
			) : (
				messages.map((message) => (
					<article
						key={message.id}
						aria-label="Mensagem do agente"
						className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"
					>
						{message.content}
					</article>
				))
			)}
			{isRunning && messages.length > 0 ? (
				<p className="text-xs text-muted-foreground animate-pulse">
					Processando…
				</p>
			) : null}
		</div>
	);
}
