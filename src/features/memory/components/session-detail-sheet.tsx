import { Progress } from "@/components/ui/progress";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

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

interface SessionDetailSheetProps {
	session: Session | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SessionDetailSheet({
	session,
	open,
	onOpenChange,
}: SessionDetailSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="sm:max-w-md">
				<SheetHeader>
					<SheetTitle>{session?.topic ?? ""}</SheetTitle>
					<SheetDescription>
						{session?.examName ?? ""} &bull; {session?.sessionDate ?? ""}
					</SheetDescription>
				</SheetHeader>

				<div className="flex flex-col gap-6 p-6 pt-4">
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Accuracy</span>
							<span className="font-semibold">{session?.accuracy ?? 0}%</span>
						</div>
						<Progress value={session?.accuracy ?? 0} className="h-2" />
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="rounded-lg border border-border bg-background p-3">
							<p className="text-xs text-muted-foreground">Correct</p>
							<p className="text-xl font-bold text-success">
								{session?.correctAnswers ?? 0}
							</p>
						</div>
						<div className="rounded-lg border border-border bg-background p-3">
							<p className="text-xs text-muted-foreground">Incorrect</p>
							<p className="text-xl font-bold text-error">
								{(session?.totalQuestions ?? 0) -
									(session?.correctAnswers ?? 0)}
							</p>
						</div>
					</div>

					<div className="rounded-lg border border-border bg-muted/50 p-3">
						<p className="text-xs text-muted-foreground">Total Questions</p>
						<p className="text-lg font-semibold">
							{session?.totalQuestions ?? 0}
						</p>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
