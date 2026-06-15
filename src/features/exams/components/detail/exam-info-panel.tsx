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
			<p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			{children}
		</section>
	);
}

function StatTile({
	label,
	value,
	valueClassName,
}: {
	label: string;
	value: ReactNode;
	valueClassName?: string;
}) {
	return (
		<div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
			<dt className="text-[11px] text-muted-foreground sm:text-xs">{label}</dt>
			<dd
				className={`mt-0.5 text-sm font-medium tabular-nums sm:text-xs ${valueClassName ?? ""}`}
			>
				{value}
			</dd>
		</div>
	);
}

export function ExamInfoPanel({ exam, stats }: ExamInfoPanelProps) {
	const showPerformance =
		stats.topicStats.length > 0 && stats.totalAttempts > 0;

	return (
		<Card size="sm">
			<CardContent className="space-y-3 sm:space-y-2">
				<dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-1">
					<StatTile label="Uploaded" value={formatDate(exam.created_at)} />
					<StatTile label="Questions" value={exam.questionCount} />
					<StatTile label="Quiz attempts" value={stats.totalAttempts} />
					<StatTile
						label="Incomplete / accuracy"
						value={
							stats.totalAttempts > 0
								? `${stats.incompleteAttempts} / ${stats.overallAccuracy}%`
								: "—"
						}
						valueClassName={
							stats.totalAttempts > 0
								? accuracyColor(stats.overallAccuracy)
								: undefined
						}
					/>
				</dl>

				{exam.files.length > 0 && (
					<PanelSection
						label="Source files"
						className="border-t border-border pt-3 sm:pt-2"
					>
						<ul className="space-y-1">
							{exam.files.map((file) => (
								<li
									key={file.id}
									className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground sm:flex-row sm:items-baseline sm:gap-1"
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
						className="border-t border-border pt-3 sm:pt-2"
					>
						<div className="flex flex-wrap gap-1.5">
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
						className="border-t border-border pt-3 sm:pt-2"
					>
						<div className="space-y-2.5">
							{stats.topicStats.map((topic) => (
								<div key={topic.topic}>
									<div className="mb-1 flex flex-col gap-0.5 text-xs sm:mb-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
										<span className="truncate font-medium">{topic.topic}</span>
										<span
											className={`shrink-0 tabular-nums ${accuracyColor(topic.accuracy)}`}
										>
											{topic.attempts} att · {topic.correctAnswers}/
											{topic.completedAnswers} ({topic.accuracy}%)
										</span>
									</div>
									<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted sm:h-1">
										<div
											className={`h-full rounded-full transition-all ${accuracyBarClass(topic.accuracy)}`}
											style={{ width: `${topic.accuracy}%` }}
										/>
									</div>
								</div>
							))}

							<div className="border-t border-border pt-2.5 sm:pt-2">
								<div className="mb-1 flex flex-col gap-0.5 text-xs sm:mb-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
									<span className="font-medium">Overall</span>
									<span
										className={`shrink-0 tabular-nums ${accuracyColor(stats.overallAccuracy)}`}
									>
										{stats.completedAttempts} complete ·{" "}
										{stats.incompleteAttempts} inc · {stats.overallAccuracy}%
									</span>
								</div>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted sm:h-1">
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
