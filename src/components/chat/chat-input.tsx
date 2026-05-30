import { Loader, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
	input: string;
	onInputChange: (value: string) => void;
	onSend: () => void;
	isLoading: boolean;
	inputTokens: number;
	outputTokens: number;
	contextTokens: number;
}

export function ChatInput({
	input,
	onInputChange,
	onSend,
	isLoading,
	inputTokens,
	outputTokens,
	contextTokens,
}: ChatInputProps) {
	return (
		<CardFooter className="border-t border-border p-2">
			<div className="flex-1 space-y-1.5">
				<p className="px-1 text-[11px] text-muted-foreground">
					input: {inputTokens.toLocaleString()} • output:{" "}
					{outputTokens.toLocaleString()} • context:{" "}
					{contextTokens.toLocaleString()} tokens
				</p>
				<div className="relative">
					<Textarea
						className="min-h-32 max-h-40vh pr-12"
						rows={3}
						placeholder="Ask a question..."
						value={input}
						onChange={(e) => onInputChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								onSend();
							}
						}}
					/>
					<Button
						size="icon"
						className="absolute bottom-2 right-2 shrink-0"
						onClick={onSend}
						disabled={!input.trim() || isLoading}
					>
						{isLoading ? (
							<Loader className="animate-spin ease-in-out" />
						) : (
							<Send className="size-4" />
						)}
					</Button>
				</div>
			</div>
		</CardFooter>
	);
}
