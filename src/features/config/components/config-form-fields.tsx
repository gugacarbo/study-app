import type { Control } from "react-hook-form";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { FormFieldsValues } from "./config-form-schema";

type ConfigFormFieldsProps = {
	control: Control<FormFieldsValues>;
	hasApiKey: boolean;
};

export function ConfigFormFields({ control, hasApiKey }: ConfigFormFieldsProps) {
	return (
		<>
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
							<Input
								{...field}
								type="password"
								autoComplete="off"
								placeholder={
									hasApiKey
										? "Saved — leave blank to keep current key"
										: "sk-..."
								}
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</>
	);
}
