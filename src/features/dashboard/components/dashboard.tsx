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
import { getExams, getStats } from "@/server-functions/stats";

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

			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
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
							<Link from="/" to="/exams">
								Upload one now
							</Link>
						</Button>
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
											from="/"
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
