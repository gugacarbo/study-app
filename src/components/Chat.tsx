import { useState, useRef, useEffect } from "react";
import { ChatClient, fetchServerSentEvents } from "@tanstack/ai-client";
import type { UIMessage } from "@tanstack/ai-client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function Chat() {
	const [messages, setMessages] = useState<UIMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | undefined>();
	const [input, setInput] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);

	const stateRef = useRef({ setMessages, setIsLoading, setError });
	stateRef.current = { setMessages, setIsLoading, setError };

	const [chatClient] = useState(
		() =>
			new ChatClient({
				initialMessages: [
					{
						id: "welcome",
						role: "assistant",
						parts: [
							{
								type: "text" as const,
								content:
									"Hi! I'm your study assistant. Ask me anything about your subjects.",
							},
						],
					},
				],
				connection: fetchServerSentEvents("/api/chat"),
				onMessagesChange: (msgs) => stateRef.current.setMessages([...msgs]),
				onLoadingChange: (loading) => stateRef.current.setIsLoading(loading),
				onErrorChange: (err) => stateRef.current.setError(err),
			}),
	);

	useEffect(() => {
		setMessages(chatClient.getMessages());
		setIsLoading(chatClient.getIsLoading());
		setError(chatClient.getError());
	}, [chatClient]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	async function handleSend() {
		const text = input.trim();
		if (!text || isLoading) return;

		setInput("");
		await chatClient.sendMessage(text);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	return (
		<div>
			<h1 className="text-2xl font-bold mb-6">Chat</h1>

			<Card className="flex flex-col" style={{ height: "60vh" }}>
				<CardContent className="flex-1 overflow-y-auto space-y-4">
					{messages.map((msg) => (
						<div
							key={msg.id}
							className={`flex ${
								msg.role === "user" ? "justify-end" : "justify-start"
							}`}
						>
							<div
								className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
									msg.role === "user"
										? "bg-primary text-primary-foreground"
										: "bg-card border border-border text-card-foreground"
								}`}
							>
								{msg.parts.map((part, i) =>
									part.type === "text" ? (
										<span key={i}>{part.content}</span>
									) : part.type === "thinking" ? (
										<span
											key={i}
											className="italic text-muted-foreground"
										>
											{part.content}
										</span>
									) : null,
								)}
							</div>
						</div>
					))}

					{isLoading && (
						<div className="flex justify-start">
							<div className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
								Thinking...
							</div>
						</div>
					)}

					{error && (
						<div className="flex justify-center">
							<div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
								{error.message}
							</div>
						</div>
					)}

					<div ref={bottomRef} />
				</CardContent>

				<CardFooter className="border-t border-border gap-2">
					<Textarea
						className="min-h-[2.5rem] flex-1"
						rows={2}
						placeholder="Ask a question..."
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					<Button
						className="shrink-0 self-end"
						onClick={handleSend}
						disabled={!input.trim() || isLoading}
					>
						Send
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
