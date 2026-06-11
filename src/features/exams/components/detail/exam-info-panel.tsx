import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { accuracyColor, formatDate, formatFileSize } from "./exam-utils";

interface ExamInfoPanelProps {
	exam: {
		created_at: string | null;
		questionCount: number;
		files: { id: number; name: string; size: number | null }[];
		topics: string[];
	};
	stats: {
		totalAttempts: number;
		incompleteAttempts: number;
		overallAccuracy: number;
		completedAttempts: number;
		topicStats: {
			topic: string;
			accuracy: number;
			attempts: number;
			completedAnswers: number;
			correctAnswers: number;
		}[];
	};
}

function accuracyBarClass(accuracy: number): string {
	if (accuracy >= 70) return "bg-success";
	if (accuracy >= 40) return "bg-warning";
	return "bg-error";
}

function PanelSection({
	label,
	children,
	className,
}: {
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={className}>
			<p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			{children}
		</section>
	);
}

export function ExamInfoPanel({ exam, stats }: ExamInfoPanelProps) {
	const showPerformance =
		stats.topicStats.length > 0 && stats.totalAttempts > 0;

	return (
		<Card size="sm">
			<CardContent className="space-y-2">
				<dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
					<div>
						<dt className="text-muted-foreground">Uploaded</dt>
						<dd className="font-medium tabular-nums">
							{formatDate(exam.created_at)}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Questions</dt>
						<dd className="font-medium tabular-nums">{exam.questionCount}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Quiz attempts</dt>
						<dd className="font-medium tabular-nums">{stats.totalAttempts}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Incomplete / accuracy</dt>
						<dd
							className={`font-medium tabular-nums ${accuracyColor(stats.overallAccuracy)}`}
						>
							{stats.totalAttempts > 0
								? `${stats.incompleteAttempts} / ${stats.overallAccuracy}%`
								: "—"}
						</dd>
					</div>
				</dl>

				{exam.files.length > 0 && (
					<PanelSection
						label="Source files"
						className="border-t border-border pt-2"
					>
						<ul className="space-y-0.5">
							{exam.files.map((file) => (
								<li
									key={file.id}
									className="flex min-w-0 items-baseline gap-1 text-xs text-muted-foreground"
								>
									<span className="truncate text-foreground">{file.name}</span>
									<span className="shrink-0 tabular-nums">
										({formatFileSize(file.size)})
									</span>
								</li>
							))}
						</ul>
					</PanelSection>
				)}

				{exam.topics.length > 0 && (
					<PanelSection
						label="Topics"
						className="border-t border-border pt-2"
					>
						<div className="flex flex-wrap gap-1">
							{exam.topics.map((topic) => (
								<Badge key={topic} variant="secondary" className="text-[11px]">
									{topic}
								</Badge>
							))}
						</div>
					</PanelSection>
				)}

				{showPerformance && (
					<PanelSection
						label="Performance by topic"
						className="border-t border-border pt-2"
					>
						<div className="space-y-2">
							{stats.topicStats.map((topic) => (
								<div key={topic.topic}>
									<div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
										<span className="truncate font-medium">{topic.topic}</span>
										<span
											className={`shrink-0 tabular-nums ${accuracyColor(topic.accuracy)}`}
										>
											{topic.attempts} att · {topic.correctAnswers}/
											{topic.completedAnswers} ({topic.accuracy}%)
										</span>
									</div>
									<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
										<div
											className={`h-full rounded-full transition-all ${accuracyBarClass(topic.accuracy)}`}
											style={{ width: `${topic.accuracy}%` }}
										/>
									</div>
								</div>
							))}

							<div className="border-t border-border pt-2">
								<div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
									<span className="font-medium">Overall</span>
									<span
										className={`shrink-0 tabular-nums ${accuracyColor(stats.overallAccuracy)}`}
									>
										{stats.completedAttempts} complete ·{" "}
										{stats.incompleteAttempts} inc · {stats.overallAccuracy}%
									</span>
								</div>
								<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
									<div
										className={`h-full rounded-full transition-all ${accuracyBarClass(stats.overallAccuracy)}`}
										style={{ width: `${stats.overallAccuracy}%` }}
									/>
								</div>
							</div>
						</div>
					</PanelSection>
				)}
			</CardContent>
		</Card>
	);
}
