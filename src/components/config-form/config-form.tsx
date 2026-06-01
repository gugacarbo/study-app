import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { TestConnectionDialog } from "@/features/ai/components/config/test-connection-dialog";
import { useConnectionTest } from "@/features/ai/components/config/use-connection-test";
import { cn } from "@/lib/utils";
import type { ProviderConfig } from "../../lib/validation";
import { getConfig, setConfig } from "../../server-functions/config";
import { ConfigFormFields } from "./config-form-fields";
import { formFieldsSchema } from "./config-form-schema";

type FormValues = {
	provider: "openrouter" | "openai" | "groq" | "ollama" | "custom";
	model: string;
	baseUrl?: string;
	apiKey: string;
};

export function ConfigForm() {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
		"idle",
	);
	const [message, setMessage] = useState("");

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

	const form = useForm({
		resolver: zodResolver(formFieldsSchema),
		defaultValues: initialValues,
	});

	useEffect(() => {
		form.reset(initialValues);
	}, [form, initialValues]);

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
						<ConfigFormFields control={form.control} />
						<div className="flex gap-3">
							<Button type="submit" disabled={status === "saving"}>
								{status === "saving" ? "Saving..." : "Save Configuration"}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={isTestDisabled}
								onClick={() => {
									const values = form.getValues();
									handleTest({
										...values,
										baseUrl: values.baseUrl || undefined,
									} as ProviderConfig);
								}}
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
								"border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
							status === "error" &&
								"border-destructive/20 bg-destructive/10 text-destructive",
						)}
					>
						{message}
					</div>
				)}
			</CardContent>

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
		</Card>
	);
}
