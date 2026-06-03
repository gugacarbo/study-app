import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { accuracyColor } from "./exam-utils";

interface TopicStat {
	topic: string;
	accuracy: number;
	correct: number;
	total: number;
}

interface TopicStatsCardProps {
	topicStats: TopicStat[];
	overallAccuracy: number;
	totalAttempts: number;
	correctAttempts: number;
}

export function TopicStatsCard({
	topicStats,
	overallAccuracy,
	totalAttempts,
	correctAttempts,
}: TopicStatsCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
					<BarChart3 className="h-4 w-4" />
					Performance by Topic
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{topicStats.map((topic) => (
						<div key={topic.topic}>
							<div className="flex items-center justify-between text-sm mb-1">
								<span className="text-foreground truncate">{topic.topic}</span>
								<span
									className={`font-medium text-xs ${accuracyColor(topic.accuracy)}`}
								>
									{topic.correct}/{topic.total} ({topic.accuracy}%)
								</span>
							</div>
							<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
								<div
									className={`h-full rounded-full transition-all ${
										topic.accuracy >= 70
											? "bg-success"
											: topic.accuracy >= 40
												? "bg-warning"
												: "bg-error"
									}`}
									style={{ width: `${topic.accuracy}%` }}
								/>
							</div>
						</div>
					))}

					<div className="pt-2 border-t border-border">
						<div className="flex items-center justify-between text-sm mb-1">
							<span className="font-semibold text-foreground">Overall</span>
							<span
								className={`font-semibold text-xs ${accuracyColor(overallAccuracy)}`}
							>
								{correctAttempts}/{totalAttempts} ({overallAccuracy}%)
							</span>
						</div>
						<div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
							<div
								className={`h-full rounded-full transition-all ${
									overallAccuracy >= 70
										? "bg-success"
										: overallAccuracy >= 40
											? "bg-warning"
											: "bg-error"
								}`}
								style={{ width: `${overallAccuracy}%` }}
							/>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
