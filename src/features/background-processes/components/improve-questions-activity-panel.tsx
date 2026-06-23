import { useEffect, useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { IngestJobThread } from "@/features/background-processes/components/ingest-job-thread";
import type { ImproveMonitorState } from "@/features/background-processes/lib/improve-event-mapper";
import type { JobStatus } from "@/lib/job-kinds";
import { LoaderCircleIcon } from "lucide-react";

type ImproveQuestionsActivityPanelProps = {
	monitor: ImproveMonitorState;
	status: JobStatus | null;
};

function isExpandedByDefault(status: string): boolean {
	return status === "running" || status === "failed";
}

export function ImproveQuestionsActivityPanel({
	monitor,
	status,
}: ImproveQuestionsActivityPanelProps) {
	const [expanded, setExpanded] = useState<string[]>(
		monitor.questions
			.filter((question) => isExpandedByDefault(question.status))
			.map((question) => question.questionId),
	);

	useEffect(() => {
		setExpanded((current) => {
			const next = new Set(current);
			for (const question of monitor.questions) {
				if (isExpandedByDefault(question.status)) {
					next.add(question.questionId);
				}
			}
			return [...next];
		});
	}, [monitor.questions]);

	return (
		<div className="flex h-full flex-col">
			<div className="border-b px-4 py-2">
				<h2 className="text-sm font-medium">Atividade</h2>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-4">
				<Accordion
					type="multiple"
					value={expanded}
					onValueChange={setExpanded}
					className="flex flex-col gap-3"
				>
					{monitor.questions.map((question) => (
						<AccordionItem
							key={question.questionId}
							value={question.questionId}
							className="overflow-hidden rounded-xl border"
						>
							<AccordionTrigger className="px-4 py-3 hover:no-underline">
								<div className="flex flex-1 items-center gap-3 text-left">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium">
												Questão {question.questionNumber}
											</span>
											{question.status === "running" ? (
												<LoaderCircleIcon
													className="size-4 animate-spin text-primary"
													aria-hidden
												/>
											) : null}
										</div>
										<p className="text-xs text-muted-foreground">
											{question.stage}
										</p>
									</div>
									<Badge variant="outline">{question.status}</Badge>
								</div>
							</AccordionTrigger>
							<AccordionContent className="border-t">
								<div className="max-h-[32rem] min-h-32">
									<IngestJobThread
										messages={question.messages}
										isRunning={question.status === "running"}
										status={
											question.status === "failed"
												? "failed"
												: question.status === "completed"
													? "completed"
													: status
										}
										showHeader={false}
									/>
								</div>
								{question.error ? (
									<p className="border-t px-4 py-3 text-sm text-destructive">
										{question.error}
									</p>
								) : null}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		</div>
	);
}
