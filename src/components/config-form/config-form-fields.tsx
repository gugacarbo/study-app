import type { Control } from "react-hook-form";
import { z } from "zod";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const formFieldsSchema = z.object({
	provider: z.enum(["openrouter", "openai", "groq", "ollama", "custom"]),
	model: z.string().min(1, "Model is required"),
	baseUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
	apiKey: z.string(),
});

export type FormFieldsValues = z.infer<typeof formFieldsSchema>;

type ConfigFormFieldsProps = {
	control: Control<FormFieldsValues>;
};

export function ConfigFormFields({ control }: ConfigFormFieldsProps) {
	return (
		<>
			<FormField
				control={control}
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
				control={control}
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
				control={control}
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
				control={control}
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
		</>
	);
}
