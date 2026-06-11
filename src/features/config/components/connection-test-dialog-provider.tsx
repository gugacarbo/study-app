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
import { buildConnectionTestMessages } from "@/features/ai/lib/connection-test-stream";
import {
	backgroundProcessStore,
	connectionTestProcessId,
	isConnectionTestProcess,
	parseConnectionTestProcessId,
	startConnectionTest,
	type ConnectionTestBackgroundProcess,
	type StartConnectionTestOptions,
} from "@/features/background-processes";
import { listModels } from "@/server-functions/ai-models";

function processToTestStatus(
	process: ConnectionTestBackgroundProcess | null,
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

function selectConnectionTestProcess(
	state: typeof backgroundProcessStore.state,
	modelId: number | null,
): ConnectionTestBackgroundProcess | null {
	if (modelId == null) return null;
	const process = state.processes.find(
		(candidate) => candidate.id === connectionTestProcessId(modelId),
	);
	if (!process || !isConnectionTestProcess(process)) return null;
	return process;
}

export function ConnectionTestDialogProvider({
	children,
	onOpen,
}: {
	children: React.ReactNode;
	onOpen?: (modelId: number) => void;
}) {
	const [openModelId, setOpenModelId] = useState<number | null>(null);
	const focusedProcessId = useStore(
		backgroundProcessStore,
		(state) => state.focusedProcessId,
	);
	const process = useStore(backgroundProcessStore, (state) =>
		selectConnectionTestProcess(state, openModelId),
	);

	const { data: models = [] } = useQuery({
		queryKey: ["ai-models"],
		queryFn: () => listModels(),
		enabled: openModelId != null,
	});

	const selectedModel = models.find((model) => model.id === openModelId);

	const openDialog = useCallback(
		(modelId: number) => {
			setOpenModelId(modelId);
			onOpen?.(modelId);
		},
		[onOpen],
	);

	const startTest = useCallback(
		(modelId: number, options: StartConnectionTestOptions) => {
			startConnectionTest(modelId, options);
			setOpenModelId(modelId);
			onOpen?.(modelId);
		},
		[onOpen],
	);

	useEffect(() => {
		if (!focusedProcessId) return;

		const modelId = parseConnectionTestProcessId(focusedProcessId);
		if (modelId == null) return;

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

		startConnectionTest(openModelId, {
			modelDisplayName: displayName,
			providerName,
		});
	}, [openModelId, process, selectedModel]);

	const testStatus = processToTestStatus(process);
	const testMessages = useMemo(() => {
		if (!process?.prompt.trim()) return [];
		return buildConnectionTestMessages(process.prompt, process.response);
	}, [process?.prompt, process?.response]);

	const modelLabel = selectedModel
		? `${selectedModel.displayName} (${selectedModel.providerName})`
		: process
			? `${process.modelDisplayName}${
					process.providerName ? ` (${process.providerName})` : ""
				}`
			: undefined;

	const contextValue = useMemo(
		() => ({ openDialog, startTest }),
		[openDialog, startTest],
	);

	return (
		<ConnectionTestDialogContext.Provider value={contextValue}>
			{children}
			<TestConnectionDialog
				open={openModelId != null}
				onOpenChange={(open) => {
					if (!open) setOpenModelId(null);
				}}
				testStatus={testStatus}
				testProgress={process?.progress ?? 0}
				testStep={process?.step ?? ""}
				testMessages={testMessages}
				tokenTotals={process?.tokenTotals ?? null}
				streamMetrics={process?.streamMetrics ?? null}
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
