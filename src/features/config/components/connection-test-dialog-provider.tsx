import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { TestConnectionDialog } from "@/features/ai/components/config/test-connection-dialog";
import type { TestStatus } from "@/features/ai/components/config/use-connection-test";
import {
	backgroundProcessStore,
	isConnectionTestProcess,
	isModelBenchmarkProcess,
	parseConnectionTestProcessId,
	parseModelBenchmarkProcessId,
	startConnectionTest,
	startModelBenchmark,
	type ConnectionTestBackgroundProcess,
	type ModelBenchmarkBackgroundProcess,
	type StartConnectionTestOptions,
	type StartModelBenchmarkOptions,
} from "@/features/background-processes";
import {
	getModelTestProcessForModel,
	type ModelTestMode,
} from "@/features/config/lib/model-test-process";
import { listModels } from "@/server-functions/ai-models";

function processToTestStatus(
	process: ConnectionTestBackgroundProcess | ModelBenchmarkBackgroundProcess | null,
): TestStatus {
	if (!process) return "idle";
	if (process.status === "queued" || process.status === "running") {
		return "testing";
	}
	if (process.status === "success") return "success";
	if (process.status === "error" || process.status === "canceled") {
		return "error";
	}
	return "idle";
}

type ConnectionTestDialogContextValue = {
	openDialog: (modelId: number) => void;
	startTest: (modelId: number, options: StartConnectionTestOptions) => void;
	startBenchmark: (modelId: number, options: StartModelBenchmarkOptions) => void;
};

const ConnectionTestDialogContext =
	createContext<ConnectionTestDialogContextValue | null>(null);

export function useConnectionTestDialog() {
	const context = useContext(ConnectionTestDialogContext);
	if (!context) {
		throw new Error(
			"useConnectionTestDialog must be used within ConnectionTestDialogProvider",
		);
	}
	return context;
}

function selectModelTestState(
	state: typeof backgroundProcessStore.state,
	modelId: number | null,
): {
	process: ConnectionTestBackgroundProcess | ModelBenchmarkBackgroundProcess | null;
	mode: ModelTestMode;
} {
	if (modelId == null) {
		return { process: null, mode: "quick" };
	}

	const selection = getModelTestProcessForModel(modelId, state.processes);
	if (!selection) {
		return { process: null, mode: "quick" };
	}

	if (
		isConnectionTestProcess(selection.process) ||
		isModelBenchmarkProcess(selection.process)
	) {
		return {
			process: selection.process,
			mode: selection.mode,
		};
	}

	return { process: null, mode: "quick" };
}

export function ConnectionTestDialogProvider({
	children,
	onOpen,
}: {
	children: React.ReactNode;
	onOpen?: (modelId: number) => void;
}) {
	const [openModelId, setOpenModelId] = useState<number | null>(null);
	const [preferredMode, setPreferredMode] = useState<ModelTestMode>("quick");
	const focusedProcessId = useStore(
		backgroundProcessStore,
		(state) => state.focusedProcessId,
	);
	const { process, mode } = useStore(backgroundProcessStore, (state) =>
		selectModelTestState(state, openModelId),
	);

	const { data: models = [] } = useQuery({
		queryKey: ["ai-models"],
		queryFn: () => listModels(),
		enabled: openModelId != null,
	});

	const selectedModel = models.find((model) => model.id === openModelId);
	const testMode = process ? mode : preferredMode;

	const openDialog = useCallback(
		(modelId: number) => {
			setOpenModelId(modelId);
			onOpen?.(modelId);
		},
		[onOpen],
	);

	const startTest = useCallback(
		(modelId: number, options: StartConnectionTestOptions) => {
			setPreferredMode("quick");
			startConnectionTest(modelId, options);
			setOpenModelId(modelId);
			onOpen?.(modelId);
		},
		[onOpen],
	);

	const startBenchmark = useCallback(
		(modelId: number, options: StartModelBenchmarkOptions) => {
			setPreferredMode("benchmark");
			startModelBenchmark(modelId, options);
			setOpenModelId(modelId);
			onOpen?.(modelId);
		},
		[onOpen],
	);

	useEffect(() => {
		if (!focusedProcessId) return;

		const connectionModelId = parseConnectionTestProcessId(focusedProcessId);
		const benchmarkModelId = parseModelBenchmarkProcessId(focusedProcessId);
		const modelId = connectionModelId ?? benchmarkModelId;
		if (modelId == null) return;

		if (benchmarkModelId != null) {
			setPreferredMode("benchmark");
		} else {
			setPreferredMode("quick");
		}

		setOpenModelId(modelId);
		onOpen?.(modelId);
		backgroundProcessStore.setState((state) => ({
			...state,
			focusedProcessId: null,
		}));
	}, [focusedProcessId, onOpen]);

	const retest = useCallback(() => {
		if (openModelId == null) return;

		const displayName =
			selectedModel?.displayName ?? process?.modelDisplayName ?? "Model";
		const providerName =
			selectedModel?.providerName ?? process?.providerName ?? undefined;

		if (testMode === "benchmark") {
			startModelBenchmark(openModelId, {
				modelDisplayName: displayName,
				providerName,
			});
			return;
		}

		startConnectionTest(openModelId, {
			modelDisplayName: displayName,
			providerName,
		});
	}, [openModelId, process, selectedModel, testMode]);

	const testStatus = processToTestStatus(process);
	const testMessages = useMemo(() => {
		if (!process) return [];
		if (isModelBenchmarkProcess(process)) {
			return process.messages;
		}
		if (isConnectionTestProcess(process)) {
			return process.messages;
		}
		return [];
	}, [process]);

	const phaseMetrics = useMemo(() => {
		if (process && isModelBenchmarkProcess(process)) {
			return process.phases;
		}
		return [];
	}, [process]);

	const modelLabel = selectedModel
		? `${selectedModel.displayName} (${selectedModel.providerName})`
		: process
			? `${process.modelDisplayName}${
					process.providerName ? ` (${process.providerName})` : ""
				}`
			: undefined;

	const contextValue = useMemo(
		() => ({ openDialog, startTest, startBenchmark }),
		[openDialog, startTest, startBenchmark],
	);

	return (
		<ConnectionTestDialogContext.Provider value={contextValue}>
			{children}
			<TestConnectionDialog
				open={openModelId != null}
				onOpenChange={(open) => {
					if (!open) setOpenModelId(null);
				}}
				testMode={testMode}
				testStatus={testStatus}
				testProgress={process?.progress ?? 0}
				testStep={process?.step ?? ""}
				stepText={process?.stepText}
				logs={process?.logs ?? []}
				testMessages={testMessages}
				tokenTotals={process?.tokenTotals ?? null}
				streamMetrics={process?.streamMetrics ?? null}
				phaseMetrics={phaseMetrics}
				testError={process?.error ?? ""}
				modelLabel={modelLabel}
				inputCostPerMillion={selectedModel?.inputCostPerMillion}
				outputCostPerMillion={selectedModel?.outputCostPerMillion}
				onRetest={retest}
				showRetest={testStatus === "success" || testStatus === "error"}
			/>
		</ConnectionTestDialogContext.Provider>
	);
}
