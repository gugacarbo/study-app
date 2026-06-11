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
import { getConfig, setConfig } from "@/server-functions/config";
import { ConfigFormFields } from "./config-form-fields";
import { formFieldsSchema, type FormFieldsValues } from "./config-form-schema";

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

	const initialValues = useMemo<FormFieldsValues>(
		() => ({
			model: currentConfig.model || "openai/gpt-4o-mini",
			baseUrl: currentConfig.baseUrl ?? "",
			apiKey: "",
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

	function buildPayload(values: FormFieldsValues) {
		return {
			model: values.model,
			baseUrl: values.baseUrl || undefined,
			apiKey: values.apiKey?.trim() || undefined,
		};
	}

	async function onSubmit(values: FormFieldsValues) {
		if (!currentConfig.hasApiKey && !values.apiKey?.trim()) {
			form.setError("apiKey", { message: "API key is required" });
			return;
		}

		setStatus("saving");
		try {
			await setConfig({ data: buildPayload(values) });
			setStatus("success");
			setMessage("Config saved successfully");
			form.setValue("apiKey", "");
			queryClient.invalidateQueries({ queryKey: ["config"] });
		} catch (err) {
			setStatus("error");
			setMessage(err instanceof Error ? err.message : "Unknown error");
		}
	}

	const canTest =
		form.formState.isValid &&
		(currentConfig.hasApiKey || Boolean(form.watch("apiKey")?.trim()));

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
						<ConfigFormFields
							control={form.control}
							hasApiKey={currentConfig.hasApiKey}
						/>
						<div className="flex gap-3">
							<Button type="submit" disabled={status === "saving"}>
								{status === "saving" ? "Saving..." : "Save Configuration"}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={testStatus === "testing" || !canTest}
								onClick={() => {
									handleTest(buildPayload(form.getValues()));
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
								"border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
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
