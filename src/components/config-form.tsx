import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProviderConfig } from "../lib/validation";
import { getConfig, setConfig } from "../server-functions/config";

// Form-specific schema — extends the server schema to accept empty string for baseUrl
const formSchema = z.object({
	provider: z.enum(["openrouter", "openai", "groq", "ollama", "custom"]),
	model: z.string().min(1, "Model is required"),
	baseUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
	apiKey: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

type ConnectionProgressEvent = {
	progress: number;
	step: string;
};

type ConnectionResultEvent = {
	response: string;
};

function parseEventBlock(
	block: string,
): { event: string; data: string } | null {
	const lines = block.split(/\r?\n/);
	let event = "message";
	const dataLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith("event:")) {
			event = line.slice("event:".length).trim();
			continue;
		}
		if (line.startsWith("data:")) {
			dataLines.push(line.slice("data:".length).trim());
		}
	}

	if (dataLines.length === 0) return null;
	return { event, data: dataLines.join("\n") };
}

async function testConnectionWithStream(
	payload: ProviderConfig,
	callbacks: {
		onProgress: (event: ConnectionProgressEvent) => void;
		onPrompt: (prompt: string) => void;
		onChunk: (chunk: string) => void;
	},
): Promise<ConnectionResultEvent> {
	const response = await fetch("/api/test-connection", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `Connection test failed (${response.status})`);
	}

	if (!response.body) {
		throw new Error("Connection test stream is not available");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let result: ConnectionResultEvent | null = null;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		let separatorIndex = buffer.indexOf("\n\n");

		while (separatorIndex >= 0) {
			const block = buffer.slice(0, separatorIndex).trim();
			buffer = buffer.slice(separatorIndex + 2);

			if (block) {
				const parsed = parseEventBlock(block);
				if (parsed) {
					let data: unknown;
					try {
						data = JSON.parse(parsed.data);
					} catch {
						data = null;
					}

					if (parsed.event === "progress" && data && typeof data === "object") {
						callbacks.onProgress(data as ConnectionProgressEvent);
					}

					if (parsed.event === "prompt" && data && typeof data === "object") {
						const prompt = (data as { prompt?: string }).prompt ?? "";
						callbacks.onPrompt(prompt);
					}

					if (parsed.event === "chunk" && data && typeof data === "object") {
						const chunk = (data as { chunk?: string }).chunk ?? "";
						if (chunk) callbacks.onChunk(chunk);
					}

					if (parsed.event === "result" && data && typeof data === "object") {
						result = data as ConnectionResultEvent;
					}

					if (parsed.event === "error" && data && typeof data === "object") {
						const message =
							(data as { message?: string }).message ??
							"Unknown connection test error";
						throw new Error(message);
					}
				}
			}

			separatorIndex = buffer.indexOf("\n\n");
		}
	}

	if (!result) {
		throw new Error("Connection test stream finished without a result");
	}

	return result;
}

export function ConfigForm() {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
		"idle",
	);
	const [message, setMessage] = useState("");
	const [testStatus, setTestStatus] = useState<
		"idle" | "testing" | "success" | "error"
	>("idle");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [testProgress, setTestProgress] = useState(0);
	const [testStep, setTestStep] = useState("");
	const [testPrompt, setTestPrompt] = useState("");
	const [testResponse, setTestResponse] = useState("");
	const [testError, setTestError] = useState("");

	const { data: currentConfig } = useSuspenseQuery({
		queryKey: ["config"],
		queryFn: () => getConfig(),
	});

	const initialValues = useMemo<FormValues>(
		() => ({
			provider: currentConfig.provider || "openrouter",
			model: currentConfig.model || "openai/gpt-4o-mini",
			baseUrl: currentConfig.baseUrl ?? "",
			apiKey: currentConfig.apiKey || "",
		}),
		[currentConfig],
	);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: initialValues,
	});

	useEffect(() => {
		form.reset(initialValues);
	}, [form, initialValues]);

	async function onSubmit(values: FormValues) {
		setStatus("saving");
		try {
			await setConfig({
				data: {
					...values,
					baseUrl: values.baseUrl || undefined,
				} as ProviderConfig,
			});
			setStatus("success");
			setMessage("Config saved successfully");
			queryClient.invalidateQueries({ queryKey: ["config"] });
		} catch (err) {
			setStatus("error");
			setMessage(err instanceof Error ? err.message : "Unknown error");
		}
	}

	const isTestDisabled = testStatus === "testing" || !form.formState.isValid;

	async function handleTest() {
		const values = form.getValues();
		setDialogOpen(true);
		setTestStatus("testing");
		setTestProgress(5);
		setTestStep("Starting connection test...");
		setTestPrompt("");
		setTestResponse("");
		setTestError("");

		try {
			const result = await testConnectionWithStream(
				{
					...values,
					baseUrl: values.baseUrl || undefined,
				} as ProviderConfig,
				{
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
				},
			);

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
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>AI Provider Configuration</CardTitle>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="flex flex-col gap-4"
					>
						<FormField
							control={form.control}
							name="provider"
							render={({ field }) => (
								<FormItem>
								<FormLabel>Provider</FormLabel>
								<Select
									value={field.value || "openrouter"}
									onValueChange={field.onChange}
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder="Select provider" />
										</SelectTrigger>
									</FormControl>
										<SelectContent>
											<SelectItem value="openrouter">OpenRouter</SelectItem>
											<SelectItem value="openai">OpenAI</SelectItem>
											<SelectItem value="groq">Groq</SelectItem>
											<SelectItem value="ollama">Ollama</SelectItem>
											<SelectItem value="custom">Custom</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="model"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Model</FormLabel>
									<FormControl>
										<Input {...field} placeholder="openai/gpt-4o-mini" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="baseUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Base URL (optional)</FormLabel>
									<FormControl>
										<Input {...field} placeholder="http://localhost:11434/v1" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="apiKey"
							render={({ field }) => (
								<FormItem>
									<FormLabel>API Key</FormLabel>
									<FormControl>
										<Input {...field} type="password" placeholder="sk-..." />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex gap-3">
							<Button type="submit" disabled={status === "saving"}>
								{status === "saving" ? "Saving..." : "Save Configuration"}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={isTestDisabled}
								onClick={handleTest}
							>
								{testStatus === "testing" ? "Testing..." : "Test Connection"}
							</Button>
						</div>
					</form>
				</Form>

				{status !== "idle" && (
					<div
						className={cn(
							"mt-4 rounded-md border p-3 text-sm",
							status === "success" &&
								"border-success/20 bg-success/10 text-success",
							status === "error" &&
								"border-destructive/20 bg-destructive/10 text-destructive",
						)}
					>
						{message}
					</div>
				)}
			</CardContent>

			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) {
						setTestStatus("idle");
						setTestProgress(0);
						setTestStep("");
						setTestPrompt("");
						setTestResponse("");
						setTestError("");
					}
				}}
			>
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
									<div className="h-2 w-full overflow-hidden rounded bg-surface-hover">
										<div
											className="h-full bg-primary transition-all duration-300"
											style={{ width: `${testProgress}%` }}
										/>
									</div>
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
		</Card>
	);
}
