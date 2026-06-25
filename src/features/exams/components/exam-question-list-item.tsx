import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

type ExamQuestionListItemProps = {
	index: number;
	examId: string;
	question: QuestionDetail;
	draft?: QuestionImprovementDraftRecord;
};

function formatTopic(topic: string | null): string {
	return topic ?? "Geral";
}

export function ExamQuestionListItem({
	index,
	examId,
	question,
	draft,
}: ExamQuestionListItemProps) {
	const navigate = useNavigate();

	function handleOpen() {
		void navigate({
			to: "/exams/$examId/questions/$questionId",
			params: {
				examId,
				questionId: question.id,
			},
		});
	}

	return (
		<Card
			className="cursor-pointer rounded-lg p-0 transition-colors hover:bg-muted/40"
			role="button"
			tabIndex={0}
			onClick={handleOpen}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				handleOpen();
			}}
		>
			<CardContent className="flex items-start gap-3 px-4 py-4">
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex items-center gap-2">
						<p className="text-sm font-medium">
							Q{index} · {formatTopic(question.topic)}
						</p>
						{draft ? (
							<Badge variant="secondary" className="gap-1">
								<SparklesIcon className="size-3" />
								Melhoria pendente
							</Badge>
						) : null}
					</div>
					<p className="line-clamp-2 text-sm text-muted-foreground">
						{question.question}
					</p>
				</div>
				<ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			</CardContent>
		</Card>
	);
}
