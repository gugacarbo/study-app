import type { UIMessageChunk } from "ai";
import {
	createThinkTagParserState,
	flushThinkTagParserState,
	parseThinkTagTextDelta,
	type ThinkStreamSegment,
	type ThinkTagParserState,
} from "@/features/ai/lib/think-tag-stream-parser";

type TextLikeChunk = Extract<
	UIMessageChunk,
	{ type: "text-start" | "text-delta" | "text-end" }
>;

type StreamController = TransformStreamDefaultController<UIMessageChunk>;

interface SplitThinkTagsState {
	parser: ThinkTagParserState;
	pendingTextStart: Extract<UIMessageChunk, { type: "text-start" }> | null;
	sourceTextPartId: string | null;
	activeTextPartId: string | null;
	activeReasoningPartId: string | null;
	reasoningCounter: number;
	textContinuationCounter: number;
}

function createSplitThinkTagsState(): SplitThinkTagsState {
	return {
		parser: createThinkTagParserState(),
		pendingTextStart: null,
		sourceTextPartId: null,
		activeTextPartId: null,
		activeReasoningPartId: null,
		reasoningCounter: 0,
		textContinuationCounter: 0,
	};
}

function nextReasoningPartId(
	state: SplitThinkTagsState,
	textPartId: string,
): string {
	state.reasoningCounter += 1;
	return `${textPartId}-reasoning-${state.reasoningCounter}`;
}

function closeReasoningPart(
	controller: StreamController,
	state: SplitThinkTagsState,
): void {
	if (!state.activeReasoningPartId) return;
	controller.enqueue({
		type: "reasoning-end",
		id: state.activeReasoningPartId,
	});
	state.activeReasoningPartId = null;
}

function closeTextPart(controller: StreamController, state: SplitThinkTagsState): void {
	if (!state.activeTextPartId) return;
	controller.enqueue({
		type: "text-end",
		id: state.activeTextPartId,
	});
	state.activeTextPartId = null;
}

function openReasoningPart(
	controller: StreamController,
	state: SplitThinkTagsState,
	textPartId: string,
	providerMetadata?: TextLikeChunk extends { providerMetadata?: infer M }
		? M
		: never,
): void {
	if (state.activeReasoningPartId) return;
	const reasoningPartId = nextReasoningPartId(state, textPartId);
	state.activeReasoningPartId = reasoningPartId;
	controller.enqueue({
		type: "reasoning-start",
		id: reasoningPartId,
		...(providerMetadata != null ? { providerMetadata } : {}),
	});
}

function openTextPart(
	controller: StreamController,
	state: SplitThinkTagsState,
	textPartId: string,
	providerMetadata?: TextLikeChunk extends { providerMetadata?: infer M }
		? M
		: never,
): void {
	if (state.activeTextPartId) return;
	state.activeTextPartId = textPartId;
	controller.enqueue({
		type: "text-start",
		id: textPartId,
		...(providerMetadata != null ? { providerMetadata } : {}),
	});
}

function emitTextDelta(
	controller: StreamController,
	state: SplitThinkTagsState,
	textPartId: string,
	delta: string,
	providerMetadata?: TextLikeChunk extends { providerMetadata?: infer M }
		? M
		: never,
): void {
	if (delta.length === 0) return;
	openTextPart(controller, state, textPartId, providerMetadata);
	controller.enqueue({
		type: "text-delta",
		id: textPartId,
		delta,
		...(providerMetadata != null ? { providerMetadata } : {}),
	});
}

function emitReasoningDelta(
	controller: StreamController,
	state: SplitThinkTagsState,
	textPartId: string,
	delta: string,
	providerMetadata?: TextLikeChunk extends { providerMetadata?: infer M }
		? M
		: never,
): void {
	if (delta.length === 0) return;
	openReasoningPart(controller, state, textPartId, providerMetadata);
	controller.enqueue({
		type: "reasoning-delta",
		id: state.activeReasoningPartId!,
		delta,
		...(providerMetadata != null ? { providerMetadata } : {}),
	});
}

function resolveTextPartId(
	state: SplitThinkTagsState,
	fallbackId: string,
): string {
	if (state.activeTextPartId) {
		return state.activeTextPartId;
	}
	if (state.pendingTextStart) {
		return state.pendingTextStart.id;
	}
	if (state.reasoningCounter > 0 && state.sourceTextPartId) {
		state.textContinuationCounter += 1;
		return `${state.sourceTextPartId}-text-${state.textContinuationCounter}`;
	}
	return fallbackId;
}

function emitSegments(
	controller: StreamController,
	state: SplitThinkTagsState,
	segments: ThinkStreamSegment[],
	textPartId: string,
	providerMetadata?: TextLikeChunk extends { providerMetadata?: infer M }
		? M
		: never,
): void {
	for (const segment of segments) {
		if (segment.kind === "reasoning") {
			if (state.activeTextPartId) {
				closeTextPart(controller, state);
			}
			state.pendingTextStart = null;
			emitReasoningDelta(
				controller,
				state,
				textPartId,
				segment.content,
				providerMetadata,
			);
			continue;
		}

		if (state.activeReasoningPartId) {
			closeReasoningPart(controller, state);
		}

		const targetTextPartId = resolveTextPartId(state, textPartId);
		if (state.pendingTextStart) {
			state.pendingTextStart = null;
		}
		emitTextDelta(
			controller,
			state,
			targetTextPartId,
			segment.content,
			providerMetadata,
		);
	}
}

function handleTextStart(
	controller: StreamController,
	state: SplitThinkTagsState,
	chunk: Extract<UIMessageChunk, { type: "text-start" }>,
): void {
	closeReasoningPart(controller, state);
	closeTextPart(controller, state);
	state.pendingTextStart = chunk;
	state.sourceTextPartId = chunk.id;
	state.reasoningCounter = 0;
	state.textContinuationCounter = 0;
	state.parser = createThinkTagParserState();
}

function handleTextDelta(
	controller: StreamController,
	state: SplitThinkTagsState,
	chunk: Extract<UIMessageChunk, { type: "text-delta" }>,
): void {
	const segments = parseThinkTagTextDelta(chunk.delta, state.parser);
	emitSegments(
		controller,
		state,
		segments,
		chunk.id,
		chunk.providerMetadata,
	);
}

function handleTextEnd(
	controller: StreamController,
	state: SplitThinkTagsState,
	chunk: Extract<UIMessageChunk, { type: "text-end" }>,
): void {
	const trailingSegments = flushThinkTagParserState(state.parser);
	emitSegments(
		controller,
		state,
		trailingSegments,
		chunk.id,
		chunk.providerMetadata,
	);
	closeReasoningPart(controller, state);
	closeTextPart(controller, state);
	state.pendingTextStart = null;
	state.sourceTextPartId = null;
	state.reasoningCounter = 0;
	state.textContinuationCounter = 0;
	state.parser = createThinkTagParserState();
}

export function splitThinkTagsInUIMessageStream<
	CHUNK extends UIMessageChunk,
>(stream: ReadableStream<CHUNK>): ReadableStream<CHUNK> {
	const state = createSplitThinkTagsState();

	return stream.pipeThrough(
		new TransformStream<CHUNK, CHUNK>({
			transform(chunk, controller) {
				switch (chunk.type) {
					case "text-start":
						handleTextStart(controller, state, chunk);
						return;
					case "text-delta":
						handleTextDelta(controller, state, chunk);
						return;
					case "text-end":
						handleTextEnd(controller, state, chunk);
						return;
					default:
						controller.enqueue(chunk);
				}
			},
		}),
	);
}
