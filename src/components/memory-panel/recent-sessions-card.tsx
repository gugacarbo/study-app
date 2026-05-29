import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function RecentSessionsCard({
	sessions,
	selectedSession,
	onSelectSession,
}: {
	sessions: Session[];
	selectedSession: Session | null;
	onSelectSession: (id: number) => void;
}) {
	if (sessions.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Recent Quiz Sessions</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No sessions saved yet.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent Quiz Sessions</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-2">
					{sessions.map((s) => (
						<Card
							key={s.id}
							size="sm"
							className={
								selectedSession?.id === s.id ? "ring-2 ring-primary" : undefined
							}
						>
							<div className="p-3">
								<button
									type="button"
									className="flex w-full items-center justify-between gap-2 text-left"
									onClick={() => onSelectSession(s.id)}
								>
									<div className="flex flex-col gap-1">
										<p className="text-sm font-medium">{s.topic}</p>
										<p className="text-xs text-muted-foreground">
											{s.examName} &bull; {s.correctAnswers}/{s.totalQuestions}{" "}
											&bull; {s.sessionDate}
										</p>
									</div>
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
								</button>
								<div className="mt-2 flex justify-end">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => onSelectSession(s.id)}
									>
										Visualizar sessao
									</Button>
								</div>
							</div>
						</Card>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
