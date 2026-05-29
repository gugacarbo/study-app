import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
	input: string;
	onInputChange: (value: string) => void;
	onSend: () => void;
	isLoading: boolean;
}

export function ChatInput({
	input,
	onInputChange,
	onSend,
	isLoading,
}: ChatInputProps) {
	return (
		<CardFooter className="border-t border-border gap-3 pt-4 pb-3">
			<Textarea
				className="min-h-[5rem] max-h-48 flex-1"
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
				size="lg"
				className="shrink-0 self-end px-4"
				onClick={onSend}
				disabled={!input.trim() || isLoading}
			>
				Send
			</Button>
		</CardFooter>
	);
}
