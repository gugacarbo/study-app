import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TestConnectionDialog } from "@/features/ai/components/config/test-connection-dialog";
import { useConnectionTest } from "@/features/ai/components/config/use-connection-test";
import { AI_AGENT_TASKS } from "@/lib/validation";
import { listEnabledModels } from "@/server-functions/ai-models";
import {
	getAiSettings,
	setAgentModel,
	setDefaultModel,
} from "@/server-functions/ai-settings";

const AGENT_LABELS: Record<(typeof AI_AGENT_TASKS)[number], string> = {
	chat: "Chat",
	ingest: "Ingest",
	reviewer: "Reviewer",
	improve_questions: "Improve questions",
	quiz: "Quiz",
	explanations: "Explanations",
};

export function DefaultsPanel() {
	const queryClient = useQueryClient();
	const [testModelId, setTestModelId] = useState<string>("");
	const [message, setMessage] = useState("");

	const { data: models = [] } = useQuery({
		queryKey: ["ai-models-enabled"],
		queryFn: () => listEnabledModels(),
	});

	const { data: settings } = useQuery({
		queryKey: ["ai-settings"],
		queryFn: () => getAiSettings(),
	});

	const {
		testStatus,
		dialogOpen,
		testProgress,
		testStep,
		testPrompt,
		testResponse,
		testError,
		handleTest,
		closeDialog,
	} = useConnectionTest();

	const defaultMutation = useMutation({
		mutationFn: (modelId: number) => setDefaultModel({ data: { modelId } }),
		onSuccess: async () => {
			setMessage("Default model updated");
			await queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
		},
		onError: (error) => {
			setMessage(error instanceof Error ? error.message : "Failed to update");
		},
	});

	const agentMutation = useMutation({
		mutationFn: (input: {
			agent: (typeof AI_AGENT_TASKS)[number];
			modelId: number | null;
		}) => setAgentModel({ data: input }),
		onSuccess: async () => {
			setMessage("Agent model updated");
			await queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
		},
		onError: (error) => {
			setMessage(error instanceof Error ? error.message : "Failed to update");
		},
	});

	const modelOptions = models.map((model) => ({
		value: String(model.id),
		label: `${model.displayName} (${model.providerName})`,
	}));

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Default model</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2 max-w-md">
						<Label>Global default</Label>
						<Select
							value={
								settings?.defaultModelId
									? String(settings.defaultModelId)
									: undefined
							}
							onValueChange={(value) =>
								defaultMutation.mutate(Number.parseInt(value, 10))
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select default model" />
							</SelectTrigger>
							<SelectContent>
								{modelOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						{AI_AGENT_TASKS.map((agent) => (
							<div key={agent} className="space-y-2">
								<Label>{AGENT_LABELS[agent]}</Label>
								<Select
									value={
										settings?.agentModels[agent]
											? String(settings.agentModels[agent])
											: "default"
									}
									onValueChange={(value) =>
										agentMutation.mutate({
											agent,
											modelId:
												value === "default"
													? null
													: Number.parseInt(value, 10),
										})
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Use global default" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="default">Use global default</SelectItem>
										{modelOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Test connection</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 max-w-md">
					<div className="space-y-2">
						<Label>Model to test</Label>
						<Select value={testModelId} onValueChange={setTestModelId}>
							<SelectTrigger>
								<SelectValue placeholder="Select model" />
							</SelectTrigger>
							<SelectContent>
								{modelOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Button
						type="button"
						variant="outline"
						disabled={!testModelId || testStatus === "testing"}
						onClick={() =>
							handleTest({ modelId: Number.parseInt(testModelId, 10) })
						}
					>
						{testStatus === "testing" ? "Testing..." : "Test connection"}
					</Button>
				</CardContent>
			</Card>

			{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

			<TestConnectionDialog
				open={dialogOpen}
				onOpenChange={closeDialog}
				testStatus={testStatus}
				testProgress={testProgress}
				testStep={testStep}
				testPrompt={testPrompt}
				testResponse={testResponse}
				testError={testError}
			/>
		</div>
	);
}
