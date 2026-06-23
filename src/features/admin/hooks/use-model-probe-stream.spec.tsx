import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModelProbeStream } from "@/features/admin/hooks/use-model-probe-stream";

function ProbeHarness({
	onUpdate,
}: {
	onUpdate: (state: ReturnType<typeof useModelProbeStream>) => void;
}) {
	const probe = useModelProbeStream();
	onUpdate(probe);
	return null;
}

function createSseResponse(chunks: string[]) {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(encoder.encode(chunk));
				}
				controller.close();
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
		},
	);
}

describe("useModelProbeStream", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("posts the manual test config and derives timing metrics from the stream", async () => {
		const now = vi
			.spyOn(performance, "now")
			.mockReturnValueOnce(1000)
			.mockReturnValueOnce(1120)
			.mockReturnValueOnce(1720);

		const fetchMock = vi.fn().mockResolvedValue(
			createSseResponse([
				'data: {"type":"delta","text":"Olá"}\n\n',
				'data: {"type":"done","result":{"ok":true,"request":{"modelRowId":"row-1","savedModelId":"gpt-5","testedModelId":"gpt-5-mini","displayName":"GPT-5","providerName":"OpenAI","providerBaseUrl":"https://api.openai.com/v1","prompt":"responda com pong","maxOutputTokens":256,"timeoutMs":45000,"reasoningEffort":"high"},"response":{"ok":true,"text":"Olá","usage":{"inputTokens":10,"outputTokens":12,"totalTokens":22},"finishReason":"stop"}}}\n\n',
			]),
		);
		vi.stubGlobal("fetch", fetchMock);

		let latestState: ReturnType<typeof useModelProbeStream> | null = null;
		const getLatestState = () => {
			if (!latestState) {
				throw new Error("Expected probe state to exist");
			}
			return latestState;
		};

		render(
			<ProbeHarness
				onUpdate={(state) => {
					latestState = state;
				}}
			/>,
		);

		await act(async () => {
			await getLatestState().start({
				modelRowId: "row-1",
				savedModelId: "gpt-5",
				testedModelId: "gpt-5-mini",
				displayName: "GPT-5",
				providerName: "OpenAI",
				providerBaseUrl: "https://api.openai.com/v1",
				maxOutputTokens: 256,
				timeoutMs: 45000,
				prompt: "responda com pong",
				reasoningEffort: "high",
			});
		});

		await waitFor(() => {
			expect(getLatestState().state.status).toBe("done");
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/admin/models/row-1/test-stream",
			expect.objectContaining({
				method: "POST",
				credentials: "same-origin",
				body: JSON.stringify({
					modelId: "gpt-5-mini",
					timeoutMs: 45000,
					prompt: "responda com pong",
					reasoningEffort: "high",
				}),
			}),
		);
		expect(getLatestState().state.metrics.timeToFirstTokenMs).not.toBeNull();
		expect(getLatestState().state.metrics.totalDurationMs).not.toBeNull();
		expect(getLatestState().state.metrics.outputTokensPerSecond).not.toBeNull();
		expect(getLatestState().state.result?.request.prompt).toBe("responda com pong");
		expect(getLatestState().state.result?.request.reasoningEffort).toBe("high");
		expect(now).toHaveBeenCalled();
	});
});
