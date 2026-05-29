import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getExams, getStats } from "../server-functions/stats";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function Dashboard() {
	const { data: exams } = useSuspenseQuery({
		queryKey: ["exams"],
		queryFn: () => getExams(),
	});

	const { data: stats } = useSuspenseQuery({
		queryKey: ["stats"],
		queryFn: () => getStats(),
	});

	return (
		<div>
			<h1 className="text-2xl font-bold mb-6">Dashboard</h1>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{stats.totalAttempts}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-xs text-muted-foreground">Total Attempts</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{exams.length}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-xs text-muted-foreground">Exams Imported</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{stats.topics.length}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-xs text-muted-foreground">Topics Covered</p>
					</CardContent>
				</Card>
			</div>

			<h2 className="text-xl font-semibold mb-4">Imported Exams</h2>
			{exams.length === 0 ? (
				<Card className="py-6">
					<CardContent className="text-center text-muted-foreground">
						No exams imported yet.{" "}
						<Link
							to="/exams"
							className="text-primary hover:underline"
						>
							Upload one now
						</Link>
					</CardContent>
				</Card>
			) : (
				<div className="flex flex-col gap-3">
					{exams.map((exam) => (
						<Card key={exam.id} size="sm">
							<CardHeader>
								<CardTitle className="text-sm font-semibold">
									{exam.name}
								</CardTitle>
								<CardDescription>
									{exam.created_at
										? new Date(exam.created_at).toLocaleDateString()
										: ""}
								</CardDescription>
								<CardAction>
									<Button asChild variant="default" size="sm">
										<Link
											to="/quiz/$id"
											params={{ id: exam.id.toString() }}
										>
											Start Quiz
										</Link>
									</Button>
								</CardAction>
							</CardHeader>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
