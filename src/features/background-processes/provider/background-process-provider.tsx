import { useStore } from "@tanstack/react-store";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import {
	cancelProcess as cancelProcessAction,
	focusProcess as focusProcessInStore,
} from "../store/actions";
import { destroyLifecycle, initLifecycle } from "../store/lifecycle";
import { backgroundProcessStore, getProcessById } from "../store/store";
import {
	getActiveProcesses,
	getRecentProcesses,
	isConnectionTestProcess,
	isExplainQuestionProcess,
	isImproveQuestionsProcess,
	isIngestProcess,
} from "../store/types";
import {
	BackgroundProcessContext,
	type BackgroundProcessContextValue,
} from "./background-process-context";

export function BackgroundProcessProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const navigate = useNavigate();
	const { processes, focusedProcessId } = useStore(backgroundProcessStore);

	useEffect(() => {
		initLifecycle();
		return () => destroyLifecycle();
	}, []);

	const focusProcess = useCallback(
		(id: string) => {
			const process = getProcessById(id);
			if (!process) return;

			focusProcessInStore(id);

			if (isIngestProcess(process)) {
				navigate({ to: "/exams/upload" });
				return;
			}

			if (isImproveQuestionsProcess(process)) {
				navigate({
					to: "/exams/$id",
					params: { id: String(process.examId) },
				});
				return;
			}

			if (isExplainQuestionProcess(process)) {
				navigate({
					to: "/exams/$id",
					params: { id: String(process.examId) },
				});
				return;
			}

			if (isConnectionTestProcess(process)) {
				navigate({ to: "/admin/config" });
			}
		},
		[navigate],
	);

	const value = useMemo((): BackgroundProcessContextValue => {
		const activeProcesses = getActiveProcesses(processes);
		return {
			processes,
			activeProcesses,
			recentProcesses: getRecentProcesses(processes),
			activeCount: activeProcesses.length,
			focusedProcessId,
			focusProcess,
			cancelProcess: cancelProcessAction,
		};
	}, [processes, focusedProcessId, focusProcess]);

	return (
		<BackgroundProcessContext.Provider value={value}>
			{children}
		</BackgroundProcessContext.Provider>
	);
}
