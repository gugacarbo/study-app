import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMemoryOverview } from "../../server-functions/memory";
import { MemorySummaryCards } from "./memory-summary-cards";
import { SessionDetailSheet } from "./session-detail-sheet";
import { SessionHistoryTable } from "./session-history-table";
import { TopicPerformanceCard } from "./topic-performance-card";

interface Session {
	id: number;
	sessionDate: string;
	topic: string;
	examName: string;
	totalQuestions: number;
	correctAnswers: number;
	accuracy: number;
	createdAt: string;
}

export function MemoryVisualization() {
	const [selectedSession, setSelectedSession] = useState<Session | undefined>(
		undefined,
	);

	const { data } = useSuspenseQuery({
		queryKey: ["memory-overview"],
		queryFn: () => getMemoryOverview(),
	});

	const sessions = data.recentSessions;
	const totalSessions = sessions.length;
	const avgAccuracy =
		totalSessions > 0
			? Math.round(
					sessions.reduce((sum, s) => sum + s.accuracy, 0) / totalSessions,
				)
			: 0;
	const topics = [...new Set(sessions.map((s) => s.topic))];

	const topicStats = topics.map((topic) => {
		const topicSessions = sessions.filter((s) => s.topic === topic);
		const totalQ = topicSessions.reduce((s, x) => s + x.totalQuestions, 0);
		const correctQ = topicSessions.reduce((s, x) => s + x.correctAnswers, 0);
		const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
		return { topic, totalQ, correctQ, accuracy, count: topicSessions.length };
	});

	return (
		<div className="flex flex-col gap-4">
			<MemorySummaryCards
				totalSessions={totalSessions}
				avgAccuracy={avgAccuracy}
				topicsCount={topics.length}
				documentsCount={data.documents.length}
			/>

			<TopicPerformanceCard topicStats={topicStats} />

			<SessionHistoryTable
				sessions={sessions}
				onSelectSession={setSelectedSession}
			/>

			<SessionDetailSheet
				session={selectedSession ?? null}
				open={!!selectedSession}
				onOpenChange={(open) => {
					if (!open) setSelectedSession(undefined);
				}}
			/>
		</div>
	);
}
