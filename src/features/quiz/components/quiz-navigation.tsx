import { ChevronLeftIcon, ChevronRightIcon, FlagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type QuizNavigationProps = {
	currentIndex: number;
	total: number;
	canGoBack: boolean;
	canGoForward: boolean;
	onPrevious: () => void;
	onNext: () => void;
	onFinish: () => void;
	isFinishing?: boolean;
};

export function QuizNavigation({
	currentIndex,
	total,
	canGoBack,
	canGoForward,
	onPrevious,
	onNext,
	onFinish,
	isFinishing = false,
}: QuizNavigationProps) {
	return (
		<Card>
			<CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
				<div className="text-sm text-muted-foreground">
					Questão{" "}
					<span className="font-medium text-foreground">
						{currentIndex + 1}
					</span>{" "}
					de <span className="font-medium text-foreground">{total}</span>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onPrevious}
						disabled={!canGoBack}
					>
						<ChevronLeftIcon data-icon="inline-start" />
						Anterior
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onNext}
						disabled={!canGoForward}
					>
						Próxima
						<ChevronRightIcon data-icon="inline-end" />
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={onFinish}
						disabled={isFinishing}
					>
						<FlagIcon data-icon="inline-start" />
						{isFinishing ? "Finalizando…" : "Finalizar"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
