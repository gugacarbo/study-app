import { useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { IngestJobThread } from "@/features/background-processes/components/ingest-job-thread";
import { formatImproveQuestionStageLabel } from "@/features/background-processes/lib/improve-event-labels";
import type { ImproveMonitorState } from "@/features/background-processes/lib/improve-event-mapper";
import type { JobStatus } from "@/lib/job-kinds";
import { LoaderCircleIcon } from "lucide-react";

type ImproveQuestionsActivityPanelProps = {
	monitor: ImproveMonitorState;
	status: JobStatus | null;
};

export function ImproveQuestionsActivityPanel({
	monitor,
	status,
}: ImproveQuestionsActivityPanelProps) {
	const [expanded, setExpanded] = useState<string[]>([]);

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
					{monitor.questions.map((question) => {
						const isExpanded = expanded.includes(question.questionId);

						return (
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
											{question.status !== "completed" ? (
												<p className="text-xs text-muted-foreground">
													{formatImproveQuestionStageLabel(question.stage)}
												</p>
											) : null}
										</div>
										<Badge variant="outline">{question.status}</Badge>
									</div>
								</AccordionTrigger>
								<AccordionContent className="border-t">
									{isExpanded ? (
										<>
											<div className="max-h-[32rem] min-h-32 overflow-y-auto">
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
											{question.warnings.length > 0 ? (
												<div className="border-t px-4 py-3">
													<p className="text-xs font-medium text-amber-700">
														Alertas
													</p>
													<ul className="mt-2 flex flex-col gap-1 text-sm text-amber-700">
														{question.warnings.map((warning, index) => (
															<li key={`${question.questionId}-warning-${index}`}>
																- {warning}
															</li>
														))}
													</ul>
												</div>
											) : null}
										</>
									) : null}
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>
			</div>
		</div>
	);
}
