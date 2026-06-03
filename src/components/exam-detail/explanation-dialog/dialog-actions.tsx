import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface DialogActionsProps {
	generatingExplanations: boolean;
	questionCount: number;
	generationMessage: string | null;
	onGenerate: () => void;
}

export function DialogActions({
	generatingExplanations,
	questionCount,
	generationMessage,
	onGenerate,
}: DialogActionsProps) {
	return (
		<>
			{generationMessage && (
				<p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
					{generationMessage}
				</p>
			)}
			<DialogFooter>
				<Button
					type="button"
					onClick={onGenerate}
					disabled={generatingExplanations || questionCount === 0}
				>
					<Sparkles data-icon="inline-start" />
					{generatingExplanations ? "Gerando..." : "Gerar agora"}
				</Button>
			</DialogFooter>
		</>
	);
}
