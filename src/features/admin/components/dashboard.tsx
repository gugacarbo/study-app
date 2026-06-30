import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getExams, getStats } from "@/functions/stats";
import type { ExamListItem } from "@/db/queries/exams";

export function Dashboard() {
	const { data: exams } = useSuspenseQuery({
		queryKey: ["dashboard-exams"],
		queryFn: () => getExams(),
	});

	const { data: stats } = useSuspenseQuery({
		queryKey: ["dashboard-stats"],
		queryFn: () => getStats(),
	});

	return (
		<div className="space-y-8">
			<h1 className="font-serif text-2xl font-semibold tracking-tight">Dashboard</h1>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{stats.totalAttempts}
						</CardTitle>
						<CardDescription>Quiz Attempts</CardDescription>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{stats.incompleteAttempts}
						</CardTitle>
						<CardDescription>Incomplete Attempts</CardDescription>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							{stats.overallAccuracy}%
						</CardTitle>
						<CardDescription>Completed Accuracy</CardDescription>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl font-bold">{exams.length}</CardTitle>
						<CardDescription>Exams Imported</CardDescription>
					</CardHeader>
				</Card>
			</div>

			<h2 className="text-xl font-semibold mb-4">Imported Exams</h2>
			{exams.length === 0 ? (
				<Card className="py-6">
					<CardContent className="text-center text-muted-foreground">
						No exams imported yet.{" "}
						<Button asChild variant="link">
							<Link to="/exams">Upload one now</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="flex flex-col gap-2">
					{exams.map((exam: ExamListItem) => (
						<Card key={exam.id}>
							<CardHeader>
								<CardTitle className="text-sm font-semibold">
									{exam.name}
								</CardTitle>
								<CardDescription>
									{exam.createdAt
										? new Date(exam.createdAt).toLocaleDateString()
										: ""}
								</CardDescription>
								<CardAction>
									<Button asChild variant="default" size="sm">
										<Link to="/exams/$examId/quiz" params={{ examId: exam.id }}>
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
