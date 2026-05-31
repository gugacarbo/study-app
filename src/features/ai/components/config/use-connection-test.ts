import { useCallback, useState } from "react";
import { testConnectionWithStream } from "@/lib/sse-stream";
import type { ProviderConfig } from "@/lib/validation";

export type TestStatus = "idle" | "testing" | "success" | "error";

export function useConnectionTest() {
	const [testStatus, setTestStatus] = useState<TestStatus>("idle");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [testProgress, setTestProgress] = useState(0);
	const [testStep, setTestStep] = useState("");
	const [testPrompt, setTestPrompt] = useState("");
	const [testResponse, setTestResponse] = useState("");
	const [testError, setTestError] = useState("");

	const handleTest = useCallback(async (values: ProviderConfig) => {
		setDialogOpen(true);
		setTestStatus("testing");
		setTestProgress(5);
		setTestStep("Starting connection test...");
		setTestPrompt("");
		setTestResponse("");
		setTestError("");

		try {
			const result = await testConnectionWithStream(values, {
				onProgress: (event) => {
					setTestProgress(event.progress);
					setTestStep(event.step);
				},
				onPrompt: (prompt) => {
					setTestPrompt(prompt);
				},
				onChunk: (chunk) => {
					setTestResponse((prev) => `${prev}${chunk}`);
				},
			});

			setTestResponse((prev) =>
				prev.trim().length > 0 ? prev : result.response,
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
