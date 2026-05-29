import { useState } from "react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getMemoryOverview, searchMemory } from "../server-functions/memory";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export function MemoryPanel() {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

	const { data } = useSuspenseQuery({
		queryKey: ["memory-overview"],
		queryFn: () => getMemoryOverview(),
	});

	const searchMutation = useMutation({
		mutationFn: (query: string) => searchMemory({ data: { query } }),
	});

	const recentSessions = data.recentSessions;
	const topicNotes = data.topicNotes;
	const documents = data.documents;
	const profileSummary = data.profileNotes
		? data.profileNotes.slice(0, 600)
		: "";
	const searchResults = searchMutation.data?.results ?? [];
	const selectedSession =
		recentSessions.find((session) => session.id === selectedSessionId) ?? null;
	const selectedSessionAccuracy = selectedSession
		? selectedSession.accuracy
		: 0;
	const selectedSessionIncorrect = selectedSession
		? selectedSession.totalQuestions - selectedSession.correctAnswers
		: 0;

	return (
		<div className="flex flex-col gap-4">
			{/* Learning Profile */}
			<Card>
				<CardHeader>
					<CardTitle>Learning Profile</CardTitle>
				</CardHeader>
				<CardContent>
					{profileSummary ? (
						<MarkdownRenderer
							content={profileSummary}
							className="text-xs text-muted-foreground"
						/>
					) : (
						<p className="text-sm text-muted-foreground">
							No profile yet. Complete a quiz and we will start tracking
							memory.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Recent Quiz Sessions */}
			<Card>
				<CardHeader>
					<CardTitle>Recent Quiz Sessions</CardTitle>
				</CardHeader>
				<CardContent>
					{recentSessions.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No sessions saved yet.
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{recentSessions.map((s) => (
								<Card key={s.id}>
									<div className="p-3">
										<button
											type="button"
											className="flex w-full items-center justify-between gap-2 text-left"
											onClick={() => setSelectedSessionId(s.id)}
										>
											<div className="flex flex-col gap-1">
												<p className="text-sm font-medium">{s.topic}</p>
												<p className="text-xs text-muted-foreground">
													{s.examName} &bull; {s.correctAnswers}/
													{s.totalQuestions} &bull; {s.sessionDate}
												</p>
											</div>
											<Badge
												variant={
													s.accuracy >= 70
														? "default"
														: s.accuracy >= 40
															? "secondary"
															: "destructive"
												}
											>
												{s.accuracy}%
											</Badge>
										</button>
										<div className="mt-2 flex justify-end">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setSelectedSessionId(s.id)}
											>
												Visualizar sessao
											</Button>
										</div>
									</div>
								</Card>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{selectedSession && (
				<Card>
					<CardHeader>
						<CardTitle>Session Visualization</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div>
							<p className="text-sm font-medium">
								{selectedSession.topic} - {selectedSession.examName}
							</p>
							<p className="text-xs text-muted-foreground">
								{selectedSession.sessionDate}
							</p>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-xs">
								<span>Accuracy</span>
								<span>{selectedSessionAccuracy}%</span>
							</div>
							<Progress value={selectedSessionAccuracy} className="h-2" />
						</div>
						<div className="grid grid-cols-2 gap-2 text-sm">
							<div className="rounded-md border p-2">
								<p className="text-xs text-muted-foreground">Correct</p>
								<p className="font-semibold">
									{selectedSession.correctAnswers}
								</p>
							</div>
							<div className="rounded-md border p-2">
								<p className="text-xs text-muted-foreground">Incorrect</p>
								<p className="font-semibold">{selectedSessionIncorrect}</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Search Memory */}
			<Card>
				<CardHeader>
					<CardTitle>Search Memory</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex gap-2">
						<Input
							type="text"
							placeholder="Search saved sessions, notes, and docs..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && searchQuery.trim()) {
									searchMutation.mutate(searchQuery.trim());
								}
							}}
						/>
						<Button
							onClick={() => {
								if (searchQuery.trim()) {
									searchMutation.mutate(searchQuery.trim());
								}
							}}
							disabled={
								searchMutation.isPending || !searchQuery.trim()
							}
						>
							{searchMutation.isPending ? "Searching..." : "Search"}
						</Button>
					</div>

					{searchResults.length > 0 && (
						<div className="flex flex-col gap-2">
							{searchResults.map((result, i) => (
								<div
									key={`${result.path}-${i}`}
									className="rounded-md border border-border bg-card p-2"
								>
									<p className="mb-1 text-xs text-muted-foreground">
										{result.path}
									</p>
									<p className="text-sm">
										{result.content.slice(0, 220)}
									</p>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Topic Notes */}
			<Card>
				<CardHeader>
					<CardTitle>Topic Notes</CardTitle>
				</CardHeader>
				<CardContent>
					{topicNotes.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No topic notes saved yet.
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{topicNotes.map((note) => (
								<div
									key={`${note.topic}-${note.updatedAt}`}
									className="text-sm"
								>
									{note.topic}{" "}
									<span className="text-muted-foreground">
										({note.updatedAt})
									</span>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Memory Documents */}
			<Card>
				<CardHeader>
					<CardTitle>Memory Documents</CardTitle>
				</CardHeader>
				<CardContent>
					{documents.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No memory documents saved yet.
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{documents.map((doc) => (
								<div key={doc.id} className="text-sm">
									<span className="font-medium">{doc.name}</span>
									<span className="text-muted-foreground">
										{" "}
										&bull; {doc.type} &bull; {doc.createdAt}
									</span>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
