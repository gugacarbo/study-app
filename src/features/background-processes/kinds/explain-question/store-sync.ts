import { updateProcess } from "../../store/store";
import type { ExplainQuestionBackgroundProcess } from "../../store/types";
import { explainQuestionProcessId, isExplainQuestionProcess } from "../../store/types";

type ExplainQuestionStorePatch = Partial<
	Pick<
		ExplainQuestionBackgroundProcess,
		| "explanation"
		| "deepExplanation"
		| "agentRunState"
		| "isStreaming"
		| "streamError"
		| "phase"
	>
>;

function phaseToStatus(
	phase: ExplainQuestionBackgroundProcess["phase"],
	isStreaming: boolean,
): ExplainQuestionBackgroundProcess["status"] {
	if (isStreaming || phase === "running") return "running";
	if (phase === "done") return "success";
	if (phase === "error") return "error";
	if (phase === "canceled") return "canceled";
	return "queued";
}

function patchProcess(
	process: ExplainQuestionBackgroundProcess,
	patch: ExplainQuestionStorePatch,
): ExplainQuestionBackgroundProcess {
	const nextPhase = patch.phase ?? process.phase;
	const nextStreaming = patch.isStreaming ?? process.isStreaming;

	return {
		...process,
		...patch,
		status: phaseToStatus(nextPhase, nextStreaming),
	};
}

export function createExplainQuestionStoreBatcher(questionId: number) {
	let pending: ExplainQuestionStorePatch = {};
	let rafId: number | null = null;

	const applyPending = () => {
		rafId = null;
		if (Object.keys(pending).length === 0) return;
		const patch = pending;
		pending = {};
		const processId = explainQuestionProcessId(questionId);
		updateProcess(processId, (process) => {
			if (!isExplainQuestionProcess(process)) return process;
			return patchProcess(process, patch);
		});
	};

	return {
		queue(patch: ExplainQuestionStorePatch) {
			pending = { ...pending, ...patch };
			if (rafId === null) {
				rafId = requestAnimationFrame(applyPending);
			}
		},
		flush(patch?: ExplainQuestionStorePatch) {
			if (patch) {
				pending = { ...pending, ...patch };
			}
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			applyPending();
		},
		dispose() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			pending = {};
		},
	};
}
