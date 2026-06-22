"use client";

import {
	AssistantRuntimeProvider,
	useExternalStoreRuntime,
} from "@assistant-ui/react";
import { IngestThread } from "@/components/assistant-ui/ingest-thread";
import type { MappedThreadMessage } from "@/features/background-processes/lib/ingest-event-mapper";

type IngestJobThreadProps = {
	messages: MappedThreadMessage[];
	isRunning: boolean;
};

export function IngestJobThread({ messages, isRunning }: IngestJobThreadProps) {
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
			<IngestThread isRunning={isRunning} />
		</AssistantRuntimeProvider>
	);
}
