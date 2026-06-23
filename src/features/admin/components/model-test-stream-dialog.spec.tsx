import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelTestStreamDialog } from "@/features/admin/components/model-test-stream-dialog";

describe("ModelTestStreamDialog", () => {
	afterEach(() => {
		cleanup();
	});

	const defaultConfig = {
		modelId: "gpt-5",
		prompt: "ping",
		timeoutMs: 30000,
		reasoningEffort: "medium",
	};

	it("opens with a test configuration form and does not start automatically", () => {
		const onStart = vi.fn();

		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={onStart}
				defaultConfig={defaultConfig}
				stream={{
					status: "idle",
					assistantText: "",
					result: null,
					metrics: {
						startedAt: null,
						firstTokenAt: null,
						completedAt: null,
						totalDurationMs: null,
						timeToFirstTokenMs: null,
						outputTokensPerSecond: null,
					},
				}}
			/>,
		);

		expect(onStart).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Prompt do teste")).toHaveValue("ping");
		expect(screen.getByLabelText("Thinking")).toHaveValue("medium");
		expect(
			screen.getByRole("button", { name: "Iniciar teste" }),
		).toBeInTheDocument();
	});

	it("submits the edited test configuration when the user starts the probe", () => {
		const onStart = vi.fn();

		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={onStart}
				defaultConfig={defaultConfig}
				stream={{
					status: "idle",
					assistantText: "",
					result: null,
					metrics: {
						startedAt: null,
						firstTokenAt: null,
						completedAt: null,
						totalDurationMs: null,
						timeToFirstTokenMs: null,
						outputTokensPerSecond: null,
					},
				}}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Prompt do teste"), {
			target: { value: "responda com pong" },
		});
		fireEvent.change(screen.getByLabelText("Thinking"), {
			target: { value: "high" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Iniciar teste" }));

		expect(onStart).toHaveBeenCalledWith({
			modelId: "gpt-5",
			prompt: "responda com pong",
			timeoutMs: 30000,
			reasoningEffort: "high",
		});
	});

	it("renders think tags inside an assistant-ui reasoning block", () => {
		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={() => {}}
				defaultConfig={defaultConfig}
				stream={{
					status: "streaming",
					assistantText: "<think>Analisando</think>Resposta final",
					result: null,
					metrics: {
						startedAt: 0,
						firstTokenAt: 100,
						completedAt: null,
						totalDurationMs: null,
						timeToFirstTokenMs: 100,
						outputTokensPerSecond: null,
					},
				}}
			/>,
		);

		const reasoningTrigger = screen.getByRole("button", { name: /reasoning/i });
		expect(reasoningTrigger).toBeInTheDocument();
		fireEvent.click(reasoningTrigger);
		expect(screen.getByText("Analisando")).toBeInTheDocument();
		expect(
			screen.queryByText("<think>Analisando</think>Resposta final"),
		).not.toBeInTheDocument();
	});

	it("moves raw mode access to the footer button instead of tabs", () => {
		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={() => {}}
				defaultConfig={defaultConfig}
				stream={{
					status: "done",
					assistantText: "Resposta final",
					result: {
						ok: true,
						request: {
							modelRowId: "1",
							savedModelId: "gpt-5",
							testedModelId: "gpt-5",
							displayName: "GPT-5",
							providerName: "OpenAI",
							providerBaseUrl: "https://api.openai.com/v1",
							prompt: "ping",
							maxOutputTokens: 256,
							timeoutMs: 30000,
							reasoningEffort: "medium",
						},
						response: {
							ok: true,
							text: "Resposta final",
						},
					},
					metrics: {
						startedAt: 0,
						firstTokenAt: 120,
						completedAt: 1120,
						totalDurationMs: 1120,
						timeToFirstTokenMs: 120,
						outputTokensPerSecond: 20,
					},
				}}
			/>,
		);

		expect(screen.queryByRole("tab", { name: "Raw" })).not.toBeInTheDocument();

		const rawButton = screen.getByRole("button", { name: "Ver raw" });
		fireEvent.click(rawButton);
		expect(screen.getByText(/"modelRowId": "1"/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Voltar ao chat" }),
		).toBeInTheDocument();
	});

	it("renders the probe error as a chat message when the test fails", () => {
		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={() => {}}
				defaultConfig={defaultConfig}
				stream={{
					status: "error",
					assistantText: "Resposta parcial",
					result: {
						ok: false,
						request: {
							modelRowId: "1",
							savedModelId: "gpt-5",
							testedModelId: "gpt-5",
							displayName: "GPT-5",
							providerName: "OpenAI",
							providerBaseUrl: "https://api.openai.com/v1",
							prompt: "ping",
							maxOutputTokens: 256,
							timeoutMs: 30000,
							reasoningEffort: "medium",
						},
						response: {
							ok: false,
							error: "Timeout apos 30s",
						},
					},
					metrics: {
						startedAt: 0,
						firstTokenAt: 200,
						completedAt: 30200,
						totalDurationMs: 30200,
						timeToFirstTokenMs: 200,
						outputTokensPerSecond: null,
					},
				}}
			/>,
		);

		expect(screen.getByText("Resposta parcial")).toBeInTheDocument();
		expect(screen.getByText("Erro: Timeout apos 30s")).toBeInTheDocument();
	});

	it("shows probe metrics after the test finishes", () => {
		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={() => {}}
				defaultConfig={defaultConfig}
				stream={{
					status: "done",
					assistantText: "Resposta final",
					result: {
						ok: true,
						request: {
							modelRowId: "1",
							savedModelId: "gpt-5",
							testedModelId: "gpt-5",
							displayName: "GPT-5",
							providerName: "OpenAI",
							providerBaseUrl: "https://api.openai.com/v1",
							prompt: "ping",
							maxOutputTokens: 256,
							timeoutMs: 30000,
							reasoningEffort: "medium",
						},
						response: {
							ok: true,
							text: "Resposta final",
							usage: {
								inputTokens: 12,
								outputTokens: 24,
								totalTokens: 36,
							},
							finishReason: "stop",
						},
					},
					metrics: {
						startedAt: 0,
						firstTokenAt: 150,
						completedAt: 1350,
						totalDurationMs: 1350,
						timeToFirstTokenMs: 150,
						outputTokensPerSecond: 20,
					},
				}}
			/>,
		);

		expect(screen.getAllByText("Input")[0]).toBeInTheDocument();
		expect(screen.getByText("12")).toBeInTheDocument();
		expect(screen.getAllByText("Output")[0]).toBeInTheDocument();
		expect(screen.getByText("24")).toBeInTheDocument();
		expect(screen.getAllByText("TTFT")[0]).toBeInTheDocument();
		expect(screen.getByText("150 ms")).toBeInTheDocument();
		expect(screen.getAllByText("Tokens/s")[0]).toBeInTheDocument();
		expect(screen.getByText("20.0")).toBeInTheDocument();
	});
});
