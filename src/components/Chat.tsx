import type { UIMessage } from "@tanstack/ai-client";
import { ChatClient, fetchServerSentEvents } from "@tanstack/ai-client";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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

	function parseTextParts(
		content: string,
	): Array<
		{ type: "text"; content: string } | { type: "think"; content: string }
	> {
		const parts: Array<
			{ type: "text"; content: string } | { type: "think"; content: string }
		> = [];

		const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
		let lastIndex = 0;
		let match: RegExpExecArray | null = null;

		while ((match = thinkRegex.exec(content)) !== null) {
			if (match.index > lastIndex) {
				const text = content.slice(lastIndex, match.index).trim();
				if (text) {
					parts.push({ type: "text", content: text });
				}
			}

			const thinkContent = (match[1] || "").trim();
			if (thinkContent) {
				parts.push({ type: "think", content: thinkContent });
			}

			lastIndex = thinkRegex.lastIndex;
		}

		if (lastIndex < content.length) {
			const tail = content.slice(lastIndex).trim();
			if (tail) {
				parts.push({ type: "text", content: tail });
			}
		}

		return parts.length > 0 ? parts : [{ type: "text", content }];
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
										<div key={i} className="space-y-2">
											{parseTextParts(part.content).map(
												(parsedPart, parsedIdx) =>
													parsedPart.type === "text" ? (
														<p key={`${i}-text-${parsedIdx}`}>
															{parsedPart.content}
														</p>
													) : (
														<details
															key={`${i}-think-${parsedIdx}`}
															className="rounded-md border border-border/60 bg-muted/40"
														>
															<summary className="list-none cursor-pointer select-none rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
																Raciocínio do modelo
															</summary>
															<p className="px-2 pb-2 whitespace-pre-wrap text-xs text-muted-foreground">
																{parsedPart.content}
															</p>
														</details>
													),
											)}
										</div>
									) : part.type === "thinking" ? (
										<span key={i} className="italic text-muted-foreground">
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
