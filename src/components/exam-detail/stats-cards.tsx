import { BarChart3, Calendar, HelpCircle, ListChecks } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { accuracyColor, formatDate } from "./exam-utils";

interface StatsCardsProps {
	exam: { created_at: string | null; questionCount: number };
	stats: {
		totalAttempts: number;
		incompleteAttempts: number;
		overallAccuracy: number;
	};
}

export function StatsCards({ exam, stats }: StatsCardsProps) {
	return (
		<div className="grid grid-cols-2 gap-3">
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
						Quiz Attempts
					</div>
					<div className="font-medium text-sm">{stats.totalAttempts}</div>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardContent className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<HelpCircle className="h-3.5 w-3.5" />
						Incomplete / Accuracy
					</div>
					<div
						className={`font-medium text-sm ${accuracyColor(stats.overallAccuracy)}`}
					>
						{stats.totalAttempts > 0
							? `${stats.incompleteAttempts} / ${stats.overallAccuracy}%`
							: "—"}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
