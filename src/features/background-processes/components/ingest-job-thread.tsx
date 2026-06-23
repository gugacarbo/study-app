"use client";

import {
	AssistantRuntimeProvider,
	useExternalStoreRuntime,
} from "@assistant-ui/react";
import { IngestThread } from "@/components/assistant-ui/ingest-thread";
import type { IngestProgressState } from "@/features/background-processes/lib/ingest-event-mapper";
import type { MappedThreadMessage } from "@/features/background-processes/lib/ingest-event-mapper";
import type { IngestJobMetadata, JobStatus } from "@/lib/job-kinds";

type IngestJobThreadProps = {
	messages: MappedThreadMessage[];
	isRunning: boolean;
	status?: JobStatus | null;
	phase?: string | null;
	metadata?: IngestJobMetadata | null;
	progress?: IngestProgressState;
};

export function IngestJobThread({
	messages,
	isRunning,
	status,
	phase,
	metadata,
	progress,
}: IngestJobThreadProps) {
	const runtime = useExternalStoreRuntime<MappedThreadMessage>({
		messages,
		isRunning,
		isDisabled: true,
		convertMessage: (message) => ({
			id: message.id,
			role: message.role,
			content: message.content,
		}),
		onNew: async () => {},
	});

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<IngestThread
				isRunning={isRunning}
				status={status}
				phase={phase}
				metadata={metadata}
				progress={progress}
			/>
		</AssistantRuntimeProvider>
	);
}
