import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MemorySummaryCardsProps {
	totalSessions: number;
	avgAccuracy: number;
	topicsCount: number;
	documentsCount: number;
}

export function MemorySummaryCards({
	totalSessions,
	avgAccuracy,
	topicsCount,
	documentsCount,
}: MemorySummaryCardsProps) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card>
				<CardHeader>
					<CardTitle className="text-3xl font-bold">{totalSessions}</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">Quiz Sessions</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-3xl font-bold">{avgAccuracy}%</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">Average Accuracy</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-3xl font-bold">{topicsCount}</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">Topics Studied</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-3xl font-bold">{documentsCount}</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">Memory Documents</p>
				</CardContent>
			</Card>
		</div>
	);
}
