import { useSuspenseQuery } from "@tanstack/react-query";
import { getMemoryOverview } from "../server-functions/memory";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export function MemoryVisualization() {
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

	// Aggregate topic performance from sessions
	const topicStats = topics.map((topic) => {
		const topicSessions = sessions.filter((s) => s.topic === topic);
		const totalQ = topicSessions.reduce((s, x) => s + x.totalQuestions, 0);
		const correctQ = topicSessions.reduce((s, x) => s + x.correctAnswers, 0);
		const accuracy =
			totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
		return { topic, totalQ, correctQ, accuracy, count: topicSessions.length };
	});

	return (
		<div className="flex flex-col gap-4">
			{/* Summary Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{totalSessions}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-xs text-muted-foreground">
							Quiz Sessions
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{avgAccuracy}%
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-xs text-muted-foreground">
							Average Accuracy
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{topics.length}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-xs text-muted-foreground">
							Topics Studied
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{data.documents.length}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-xs text-muted-foreground">
							Memory Documents
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Topic Performance */}
			<Card>
				<CardHeader>
					<CardTitle>Topic Performance</CardTitle>
				</CardHeader>
				<CardContent>
					{topicStats.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No quiz sessions yet. Take a quiz to see your topic
							performance.
						</p>
					) : (
						<div className="flex flex-col gap-4">
							{topicStats.map((t) => (
								<div
									key={t.topic}
									className="flex items-center gap-4"
								>
									<div className="w-32 shrink-0">
										<p className="text-sm font-medium">
											{t.topic}
										</p>
										<p className="text-xs text-muted-foreground">
											{t.count} session{t.count > 1 ? "s" : ""}
										</p>
									</div>
									<div className="flex-1">
										<Progress
											value={t.accuracy}
											className="h-2"
										/>
									</div>
									<div className="w-16 text-right shrink-0">
										<Badge
											variant={
												t.accuracy >= 70
													? "default"
													: t.accuracy >= 40
														? "secondary"
														: "destructive"
											}
										>
											{t.accuracy}%
										</Badge>
									</div>
									<div className="w-20 text-right text-xs text-muted-foreground shrink-0">
										{t.correctQ}/{t.totalQ}
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Session History */}
			<Card>
				<CardHeader>
					<CardTitle>Session History</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{sessions.length === 0 ? (
						<div className="px-4 pb-4 text-sm text-muted-foreground">
							No sessions saved yet.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Exam</TableHead>
									<TableHead>Topic</TableHead>
									<TableHead>Score</TableHead>
									<TableHead>Accuracy</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sessions.map((s) => (
									<TableRow key={s.id}>
										<TableCell>{s.sessionDate}</TableCell>
										<TableCell>{s.examName}</TableCell>
										<TableCell className="font-medium">
											{s.topic}
										</TableCell>
										<TableCell>
											{s.correctAnswers}/{s.totalQuestions}
										</TableCell>
										<TableCell>
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
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
