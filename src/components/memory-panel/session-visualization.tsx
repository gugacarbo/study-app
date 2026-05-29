import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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

export function SessionVisualization({ session }: { session: Session }) {
	const incorrect = session.totalQuestions - session.correctAnswers;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Session Visualization</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div>
					<p className="text-sm font-medium">
						{session.topic} - {session.examName}
					</p>
					<p className="text-xs text-muted-foreground">{session.sessionDate}</p>
				</div>
				<div className="space-y-2">
					<div className="flex items-center justify-between text-xs">
						<span>Accuracy</span>
						<span>{session.accuracy}%</span>
					</div>
					<Progress value={session.accuracy} className="h-2" />
				</div>
				<div className="grid grid-cols-2 gap-2 text-sm">
					<Card size="sm">
						<CardContent className="p-2">
							<p className="text-xs text-muted-foreground">Correct</p>
							<p className="font-semibold">{session.correctAnswers}</p>
						</CardContent>
					</Card>
					<Card size="sm">
						<CardContent className="p-2">
							<p className="text-xs text-muted-foreground">Incorrect</p>
							<p className="font-semibold">{incorrect}</p>
						</CardContent>
					</Card>
				</div>
			</CardContent>
		</Card>
	);
}
