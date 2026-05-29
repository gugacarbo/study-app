import { useCallback, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { testConnectionWithStream } from "../../lib/sse-stream";
import type { ProviderConfig } from "../../lib/validation";

type TestStatus = "idle" | "testing" | "success" | "error";

type TestConnectionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	testStatus: TestStatus;
	testProgress: number;
	testStep: string;
	testPrompt: string;
	testResponse: string;
	testError: string;
};

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
export function TestConnectionDialog({
	open,
	onOpenChange,
	testStatus,
	testProgress,
	testStep,
	testPrompt,
	testResponse,
	testError,
}: TestConnectionDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md ">
				<DialogHeader>
					<DialogTitle>
						{testStatus === "error"
							? "Connection Failed"
							: "Connection Test Result"}
					</DialogTitle>
				</DialogHeader>
				{testStatus === "error" ? (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{testError}
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs text-muted-foreground">
								Test status
							</Label>
							<div className="rounded-md border border-border bg-background p-3">
								<div className="mb-2 flex items-center justify-between text-sm">
									<span className="text-muted-foreground">{testStep}</span>
									<span className="font-medium">{testProgress}%</span>
								</div>
								<Progress value={testProgress} />
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs text-muted-foreground">
								Sent to LLM
							</Label>
							<pre className="max-h-48 overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
								{testPrompt || "Waiting for prompt..."}
							</pre>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs text-muted-foreground">
								Response from LLM (streaming)
							</Label>
							<pre className="max-h-48 overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
								{testResponse || "Waiting for streamed response..."}
							</pre>
						</div>
					</div>
				)}
				<DialogFooter showCloseButton />
			</DialogContent>
		</Dialog>
	);
}
