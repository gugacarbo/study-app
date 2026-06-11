import { updateProcess } from "../../store/store";
import type { ImproveQuestionsBackgroundProcess } from "../../store/types";
import { isImproveQuestionsProcess } from "../../store/types";
import { improveQuestionsProcessId } from "../../store/types";

type ImproveQuestionsStorePatch = Partial<
	Pick<
		ImproveQuestionsBackgroundProcess,
		| "originalSnapshot"
		| "draftQuestion"
		| "agentRunState"
		| "changes"
		| "isStreaming"
		| "streamError"
		| "phase"
	>
>;

function phaseToStatus(
	phase: ImproveQuestionsBackgroundProcess["phase"],
	isStreaming: boolean,
): ImproveQuestionsBackgroundProcess["status"] {
	if (isStreaming || phase === "running") return "running";
	if (phase === "done") return "awaiting_review";
	if (phase === "error") return "error";
	if (phase === "canceled") return "canceled";
	return "queued";
}

function patchProcess(
	process: ImproveQuestionsBackgroundProcess,
	patch: ImproveQuestionsStorePatch,
): ImproveQuestionsBackgroundProcess {
	const nextPhase = patch.phase ?? process.phase;
	const nextStreaming = patch.isStreaming ?? process.isStreaming;

	return {
		...process,
		...patch,
		status: phaseToStatus(nextPhase, nextStreaming),
	};
}

export function createImproveQuestionsStoreBatcher(questionId: number) {
	let pending: ImproveQuestionsStorePatch = {};
	let rafId: number | null = null;

	const applyPending = () => {
		rafId = null;
		if (Object.keys(pending).length === 0) return;
		const patch = pending;
		pending = {};
		const processId = improveQuestionsProcessId(questionId);
		updateProcess(processId, (process) => {
			if (!isImproveQuestionsProcess(process)) return process;
			return patchProcess(process, patch);
		});
	};

	return {
		queue(patch: ImproveQuestionsStorePatch) {
			pending = { ...pending, ...patch };
			if (rafId === null) {
				rafId = requestAnimationFrame(applyPending);
			}
		},
		flush(patch?: ImproveQuestionsStorePatch) {
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
