import {
	parseJsonEventStream,
	readUIMessageStream,
	uiMessageChunkSchema,
	type ChatOnDataCallback,
	type DataUIPart,
} from "ai";
import type {
	JobErrorDataPart,
	StudyAppUIDataParts,
	StudyAppUIMessage,
	StudyAppUIMessageChunk,
} from "@/features/ai/types/ui-message-data-parts";

export type StudyAppDataUIPart = DataUIPart<StudyAppUIDataParts>;
export type JobStreamOnDataCallback = ChatOnDataCallback<StudyAppUIMessage>;

export interface ConsumeJobStreamRequest {
	url: string;
	init?: Omit<RequestInit, "signal">;
	signal?: AbortSignal;
}

export interface ConsumeJobStreamCallbacks {
	onData?: JobStreamOnDataCallback;
}

export interface ConsumeJobStreamResult {
	messages: StudyAppUIMessage[];
}

function isDataChunk(
	chunk: StudyAppUIMessageChunk,
): chunk is Extract<StudyAppUIMessageChunk, { type: `data-${string}` }> {
	return chunk.type.startsWith("data-");
}

function parseJobResponseStream(
	body: ReadableStream<Uint8Array>,
): ReadableStream<StudyAppUIMessageChunk> {
	return parseJsonEventStream({
		stream: body,
		schema: uiMessageChunkSchema,
	}).pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				if (!chunk.success) {
					controller.error(chunk.error);
					return;
				}
				controller.enqueue(chunk.value as StudyAppUIMessageChunk);
			},
		}),
	);
}

function wrapStreamForOnData(
	stream: ReadableStream<StudyAppUIMessageChunk>,
	callbacks: ConsumeJobStreamCallbacks,
	jobErrorRef: { current: JobErrorDataPart | null },
): ReadableStream<StudyAppUIMessageChunk> {
	const { onData } = callbacks;
	if (!onData) return stream;

	return stream.pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				if (isDataChunk(chunk)) {
					onData(chunk);
					if (chunk.type === "data-job-error") {
						jobErrorRef.current = chunk.data;
					}
				}
				controller.enqueue(chunk);
			},
		}),
	);
}

function upsertMessage(
	messages: StudyAppUIMessage[],
	message: StudyAppUIMessage,
): void {
	const last = messages.at(-1);
	if (last?.id === message.id) {
		messages[messages.length - 1] = message;
		return;
	}
	messages.push(message);
}

export async function consumeJobStreamFromResponse(
	response: Response,
	callbacks: ConsumeJobStreamCallbacks = {},
): Promise<ConsumeJobStreamResult> {
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `Job stream request failed (${response.status})`);
	}
	if (!response.body) {
		throw new Error("Job stream response body is empty");
	}

	const jobErrorRef = { current: null as JobErrorDataPart | null };
	let streamError: Error | undefined;

	const chunkStream = wrapStreamForOnData(
		parseJobResponseStream(response.body),
		callbacks,
		jobErrorRef,
	);

	const messages: StudyAppUIMessage[] = [];
	const messageStream = readUIMessageStream<StudyAppUIMessage>({
		stream: chunkStream,
		terminateOnError: true,
		onError: (error) => {
			streamError =
				error instanceof Error ? error : new Error(String(error));
		},
	});

	for await (const message of messageStream) {
		upsertMessage(messages, message);
	}

	if (streamError) throw streamError;
	if (jobErrorRef.current) {
		throw new Error(jobErrorRef.current.message);
	}

	return { messages };
}

export async function consumeJobStream(
	request: ConsumeJobStreamRequest,
	callbacks: ConsumeJobStreamCallbacks = {},
): Promise<ConsumeJobStreamResult> {
	const { url, init, signal } = request;
	const response = await fetch(url, { ...init, signal });
	return consumeJobStreamFromResponse(response, callbacks);
}
