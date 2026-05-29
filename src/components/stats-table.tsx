import { useSuspenseQuery } from "@tanstack/react-query";
import { getStats } from "../server-functions/stats";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export function StatsTable() {
	const { data: stats } = useSuspenseQuery({
		queryKey: ["stats"],
		queryFn: () => getStats(),
	});

	if (!stats.topics.length) {
		return (
			<Card className="py-6">
				<CardContent className="text-center text-muted-foreground">
					No stats yet. Start taking quizzes to see your progress!
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Topic</TableHead>
							<TableHead>Attempts</TableHead>
							<TableHead>Correct</TableHead>
							<TableHead>Accuracy</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{stats.topics.map((topic) => (
							<TableRow key={topic.topic}>
								<TableCell className="font-medium">
									{topic.topic}
								</TableCell>
								<TableCell>{topic.total}</TableCell>
								<TableCell>{topic.correct}</TableCell>
								<TableCell>
									<Badge
										variant={
											topic.accuracy >= 70
												? "default"
												: topic.accuracy >= 40
													? "secondary"
													: "destructive"
										}
									>
										{topic.accuracy}%
									</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
