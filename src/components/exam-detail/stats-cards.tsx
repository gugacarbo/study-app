import { Calendar, ListChecks, BarChart3, HelpCircle } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { formatDate, accuracyColor } from "./exam-utils";

interface StatsCardsProps {
	exam: { created_at: string | null; questionCount: number };
	stats: { totalAttempts: number; overallAccuracy: number };
}

export function StatsCards({ exam, stats }: StatsCardsProps) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
			<Card size="sm">
				<CardContent className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Calendar className="h-3.5 w-3.5" />
						Uploaded
					</div>
					<div className="font-medium text-sm">
						{formatDate(exam.created_at)}
					</div>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardContent className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<ListChecks className="h-3.5 w-3.5" />
						Questions
					</div>
					<div className="font-medium text-sm">{exam.questionCount}</div>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardContent className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<BarChart3 className="h-3.5 w-3.5" />
						Total Attempts
					</div>
					<div className="font-medium text-sm">{stats.totalAttempts}</div>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardContent className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<HelpCircle className="h-3.5 w-3.5" />
						Accuracy
					</div>
					<div
						className={`font-medium text-sm ${accuracyColor(stats.overallAccuracy)}`}
					>
						{stats.totalAttempts > 0 ? `${stats.overallAccuracy}%` : "—"}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
