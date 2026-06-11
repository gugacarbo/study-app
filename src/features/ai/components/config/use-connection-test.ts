import { useCallback, useState } from "react";
import { consumeJobStream } from "@/features/ai/lib/read-job-ui-message-stream";
import type {
	AgentRunDataPart,
	JobProgressDataPart,
	JobResultDataPart,
} from "@/features/ai/types/ui-message-data-parts";
import type { TestConnectionInput } from "@/lib/validation";

export type TestStatus = "idle" | "testing" | "success" | "error";

export function useConnectionTest() {
	const [testStatus, setTestStatus] = useState<TestStatus>("idle");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [testProgress, setTestProgress] = useState(0);
	const [testStep, setTestStep] = useState("");
	const [testPrompt, setTestPrompt] = useState("");
	const [testResponse, setTestResponse] = useState("");
	const [testError, setTestError] = useState("");

	const handleTest = useCallback(async (values: TestConnectionInput) => {
		setDialogOpen(true);
		setTestStatus("testing");
		setTestProgress(5);
		setTestStep("Starting connection test...");
		setTestPrompt("");
		setTestResponse("");
		setTestError("");

		try {
			let resultResponse = "";

			await consumeJobStream(
				{
					url: "/api/test-connection",
					init: {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(values),
					},
				},
				{
					onData: (part) => {
						if (part.type === "data-job-progress") {
							const data = part.data as JobProgressDataPart;
							if (data.percent != null) setTestProgress(data.percent);
							if (data.step) setTestStep(data.step);
						}
						if (part.type === "data-agent-run") {
							const data = part.data as AgentRunDataPart;
							if (
								data.eventType === "lifecycle" &&
								data.status === "pending" &&
								data.userPrompt
							) {
								setTestPrompt(data.userPrompt);
							}
							if (data.eventType === "token" && data.rawText) {
								setTestResponse((prev) => `${prev}${data.rawText}`);
							}
						}
						if (part.type === "data-job-result") {
							const data = part.data as JobResultDataPart;
							if (typeof data.response === "string") {
								resultResponse = data.response;
							}
						}
					},
				},
			);

			setTestResponse((prev) =>
				prev.trim().length > 0 ? prev : resultResponse,
			);
			setTestProgress(100);
			setTestStep("Completed");
			setTestStatus("success");
		} catch (err) {
			setTestError(err instanceof Error ? err.message : "Connection failed");
			setTestStatus("error");
		}
	}, []);

	const closeDialog = useCallback((open: boolean) => {
		setDialogOpen(open);
		if (!open) {
			setTestStatus("idle");
			setTestProgress(0);
			setTestStep("");
			setTestPrompt("");
			setTestResponse("");
			setTestError("");
		}
	}, []);

	return {
		testStatus,
		dialogOpen,
		testProgress,
		testStep,
		testPrompt,
		testResponse,
		testError,
		handleTest,
		closeDialog,
	};
}
