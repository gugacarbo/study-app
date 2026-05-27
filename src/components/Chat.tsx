import { useState, useRef, useEffect } from "react";
import { ChatClient, fetchServerSentEvents } from "@tanstack/ai-client";
import type { UIMessage } from "@tanstack/ai-client";

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

			<div className="card flex flex-col" style={{ height: "60vh" }}>
				<div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
					{messages.map((msg) => (
						<div
							key={msg.id}
							className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
									msg.role === "user"
										? "bg-primary text-white"
										: "bg-surface border border-border text-text"
								}`}
							>
								{msg.parts.map((part, i) =>
									part.type === "text" ? (
										<span key={i}>{part.content}</span>
									) : part.type === "thinking" ? (
										<span key={i} className="italic text-text-muted">
											{part.content}
										</span>
									) : null,
								)}
							</div>
						</div>
					))}

					{isLoading && (
						<div className="flex justify-start">
							<div className="bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text-muted">
								Thinking...
							</div>
						</div>
					)}

					{error && (
						<div className="flex justify-center">
							<div className="bg-error/10 text-error text-sm rounded-lg px-4 py-2">
								{error.message}
							</div>
						</div>
					)}

					<div ref={bottomRef} />
				</div>

				<div className="flex gap-2">
					<textarea
						className="input resize-none"
						rows={2}
						placeholder="Ask a question..."
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					<button
						type="button"
						className="btn shrink-0 self-end"
						onClick={handleSend}
						disabled={!input.trim() || isLoading}
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
}
