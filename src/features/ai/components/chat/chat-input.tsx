import { Loader, Send, Settings, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatInputProps {
	input: string;
	onInputChange: (value: string) => void;
	onSend: () => void;
	isLoading: boolean;
	reviewMode: boolean;
	onReviewModeChange: (value: boolean) => void;
	inputTokens: number;
	outputTokens: number;
	contextTokens: number;
}

export function ChatInput({
	input,
	onInputChange,
	onSend,
	isLoading,
	reviewMode,
	onReviewModeChange,
	inputTokens,
	outputTokens,
	contextTokens,
}: ChatInputProps) {
	return (
		<CardFooter className="border-t border-border p-2">
			<div className="flex-1">
				<div className="relative">
					<Textarea
						className="min-h-32 max-h-40vh pb-10 pr-12"
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
					<div className="absolute bottom-2 left-2 flex items-center gap-1">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
									disabled={isLoading}
								>
									<Settings className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" side="top" className="w-64">
								<DropdownMenuLabel>Settings</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => onReviewModeChange(!reviewMode)}
									className="flex items-center justify-between"
								>
									<span>Review mode</span>
									<span className="text-[11px] text-muted-foreground">
										{reviewMode ? "On" : "Off"}
									</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-[11px] text-muted-foreground">
									input: {inputTokens.toLocaleString()} • output:{" "}
									{outputTokens.toLocaleString()} • context:{" "}
									{contextTokens.toLocaleString()} tokens
								</DropdownMenuLabel>
							</DropdownMenuContent>
						</DropdownMenu>
						{reviewMode && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="shrink-0 h-8 w-8 text-primary hover:text-primary"
											onClick={() => onReviewModeChange(false)}
										>
											<ShieldCheck className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="top">
										Review mode active — click to disable
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>
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
