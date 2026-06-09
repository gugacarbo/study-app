import { cn } from "@/lib/utils";

export function DetailPayloadSection({
	children,
	error,
	className,
}: {
	children: React.ReactNode;
	error?: string;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-0", className)}>
			{children}
			{error ? (
				<p className="mt-1.5 text-[11px] font-medium leading-snug text-red-400">
					{error}
				</p>
			) : null}
		</div>
	);
}

export function DetailPayloadBlock({
	label,
	children,
	className,
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-md border border-border/40 bg-muted/40",
				className,
			)}
		>
			<div className="border-b border-border/40 px-2.5 py-1 text-[11px] font-medium leading-none text-muted-foreground">
				{label}
			</div>
			<pre className="overflow-x-auto p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
				{children}
			</pre>
		</div>
	);
}
