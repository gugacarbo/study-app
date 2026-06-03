import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

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

interface SessionHistoryTableProps {
	sessions: Session[];
	onSelectSession: (session: Session) => void;
}

export function SessionHistoryTable({
	sessions,
	onSelectSession,
}: SessionHistoryTableProps) {
	return (
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
								<TableRow
									key={s.id}
									className="cursor-pointer"
									onClick={() => onSelectSession(s)}
								>
									<TableCell>{s.sessionDate}</TableCell>
									<TableCell>{s.examName}</TableCell>
									<TableCell className="font-medium">{s.topic}</TableCell>
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
	);
}
