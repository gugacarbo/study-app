import { cn } from "@/lib/utils";

type UploadProgressProps = {
	fileName: string;
	progress: number;
};

export function UploadProgress({
	fileName,
	progress,
}: UploadProgressProps) {
	return (
		<div className="space-y-3">
			<p className="text-sm font-medium">{fileName}</p>
			<div
				role="progressbar"
				aria-valuenow={progress}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Progresso do envio"
				className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20"
			>
				<div
					className={cn(
						"h-full rounded-full bg-primary transition-[width] duration-200",
					)}
					style={{ width: `${progress}%` }}
				/>
			</div>
			<p className="text-sm text-muted-foreground">Enviando… {progress}%</p>
		</div>
	);
}
