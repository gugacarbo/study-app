import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PipelineControlsProps {
	generatingExplanations: boolean;
	batchSize: number;
	overwriteExplanations: boolean;
	generationMessage: string | null;
	questionCount: number;
	pendingCount: number;
	onBatchSizeChange: (value: number) => void;
	onOverwriteChange: (checked: boolean) => void;
	onGenerate: () => void;
}

export function PipelineControls({
	generatingExplanations,
	batchSize,
	overwriteExplanations,
	generationMessage,
	questionCount,
	pendingCount,
	onBatchSizeChange,
	onOverwriteChange,
	onGenerate,
}: PipelineControlsProps) {
	return (
		<>
			<div className="rounded-lg border border-border bg-muted p-3">
				<p className="font-medium">Pendentes</p>
				<p className="text-muted-foreground">
					{pendingCount} de {questionCount} perguntas sem explicação completa.
				</p>
			</div>
			<div>
				<span className="text-xs font-semibold text-muted-foreground">
					Tamanho do batch (1-20)
				</span>
				<Input
					type="number"
					min={1}
					max={20}
					value={batchSize}
					disabled={generatingExplanations}
					onChange={(e) => {
						const value = Number(e.target.value);
						if (Number.isNaN(value)) return;
						onBatchSizeChange(Math.max(1, Math.min(20, value)));
					}}
					className="mt-1"
				/>
			</div>
			<label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-2.5">
				<input
					type="checkbox"
					checked={overwriteExplanations}
					onChange={(e) => onOverwriteChange(e.target.checked)}
					disabled={generatingExplanations}
					className="accent-primary"
				/>
				<span>Sobrescrever explicações já existentes</span>
			</label>
			{generationMessage && (
				<p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
					{generationMessage}
				</p>
			)}
			<Button
				type="button"
				onClick={onGenerate}
				disabled={generatingExplanations || questionCount === 0}
			>
				<Sparkles data-icon="inline-start" />
				{generatingExplanations ? "Gerando..." : "Gerar agora"}
			</Button>
		</>
	);
}
