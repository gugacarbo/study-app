import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelTestStreamDialog } from "@/features/admin/components/model-test-stream-dialog";

describe("ModelTestStreamDialog", () => {
	beforeEach(() => {
		Object.defineProperty(Element.prototype, "scrollIntoView", {
			configurable: true,
			value: vi.fn(),
		});
	});

	afterEach(() => {
		cleanup();
	});

	const defaultConfig = {
		prompt: "ping",
		timeoutMs: 30000,
		testedModelId: "gpt-5",
		thinkingMode: "levels" as const,
		thinkingOptions: ["low", "medium", "high"],
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
		expect(screen.queryByLabelText("ID do modelo")).not.toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "Thinking" })).toHaveTextContent(
			"medium",
		);
		const prompt = screen.getByLabelText("Prompt do teste");
		expect(prompt).toHaveAttribute("rows", "2");
		expect(prompt.className).toContain("h-22");
		expect(
			screen.getByRole("button", { name: "Iniciar teste" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Restaurar prompt padrão" }),
		).toBeInTheDocument();
	});

	it("groups timeout and thinking on the right and stretches the start button below them", () => {
		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={() => {}}
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

		const formLayout = screen.getByTestId("probe-form-layout");
		const controlsLayout = screen.getByTestId("probe-controls-layout");
		const timeoutField = screen.getByLabelText("Timeout (s)").closest("div");
		const thinkingField = screen
			.getByRole("combobox", { name: "Thinking" })
			.closest("div");
		const startButtonRow = screen
			.getByRole("button", { name: "Iniciar teste" })
			.closest("div");

		expect(formLayout).toHaveClass(
			"lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]",
		);
		expect(controlsLayout).toHaveClass("grid-cols-2");
		expect(timeoutField).toHaveClass("col-span-1");
		expect(thinkingField).toHaveClass("col-span-1");
		expect(startButtonRow).toHaveClass("col-span-2");
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
		fireEvent.click(screen.getByRole("combobox", { name: "Thinking" }));
		fireEvent.click(screen.getByRole("option", { name: "high" }));
		fireEvent.click(screen.getByRole("button", { name: "Iniciar teste" }));

		expect(onStart).toHaveBeenCalledWith({
			prompt: "responda com pong",
			timeoutMs: 30000,
			testedModelId: "gpt-5",
			thinkingMode: "levels",
			thinkingOptions: ["low", "medium", "high"],
			reasoningEffort: "high",
		});
	});

	it("renders an on off selector when the model only supports thinking toggle", () => {
		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={() => {}}
				defaultConfig={{
					prompt: "ping",
					timeoutMs: 30000,
					testedModelId: "gpt-5",
					thinkingMode: "toggle",
					thinkingOptions: ["off", "on"],
					reasoningEffort: "on",
				}}
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

		expect(screen.getByRole("combobox", { name: "Thinking" })).toHaveTextContent(
			"on",
		);
		fireEvent.click(screen.getByRole("combobox", { name: "Thinking" }));
		expect(screen.getByRole("option", { name: "off" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "on" })).toBeInTheDocument();
	});

	it("renders the thinking dropdown above the dialog layer", () => {
		render(
			<ModelTestStreamDialog
				open
				title="Teste"
				onClose={() => {}}
				onStart={() => {}}
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

		fireEvent.click(screen.getByRole("combobox", { name: "Thinking" }));
		expect(
			screen.getByRole("listbox").closest("[data-slot='select-content']"),
		).toHaveClass("z-70");
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

	it("renders a compact stats strip with icons", () => {
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

		const statsStrip = screen.getByTestId("probe-stats");
		const inputCard = screen.getByTestId("probe-stat-input");
		const durationCard = screen.getByTestId("probe-stat-duration");

		expect(statsStrip).toHaveClass("gap-2", "py-2");
		expect(inputCard).toHaveClass("px-2", "py-1.5");
		expect(durationCard).toHaveClass("px-2", "py-1.5");
		expect(screen.getByTestId("probe-stat-icon-input")).toBeInTheDocument();
		expect(screen.getByTestId("probe-stat-icon-ttft")).toBeInTheDocument();
		expect(screen.getByTestId("probe-stat-icon-finish")).toBeInTheDocument();
	});
});
