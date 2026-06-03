import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface TopicStat {
	topic: string;
	totalQ: number;
	correctQ: number;
	accuracy: number;
	count: number;
}

interface TopicPerformanceCardProps {
	topicStats: TopicStat[];
}

export function TopicPerformanceCard({
	topicStats,
}: TopicPerformanceCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Topic Performance</CardTitle>
			</CardHeader>
			<CardContent>
				{topicStats.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No quiz sessions yet. Take a quiz to see your topic performance.
					</p>
				) : (
					<div className="flex flex-col gap-4">
						{topicStats.map((t) => (
							<div key={t.topic} className="flex items-center gap-4">
								<div className="w-32 shrink-0">
									<p className="text-sm font-medium">{t.topic}</p>
									<p className="text-xs text-muted-foreground">
										{t.count} session{t.count > 1 ? "s" : ""}
									</p>
								</div>
								<div className="flex-1">
									<Progress value={t.accuracy} className="h-2" />
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
	);
}
