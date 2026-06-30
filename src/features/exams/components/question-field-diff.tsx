import { diff_match_patch as DiffMatchPatch } from "diff-match-patch";

const dmp = new DiffMatchPatch();

type DiffOperation = -1 | 0 | 1;

type TextDiffPart = {
	op: DiffOperation;
	text: string;
};

export function computeTextDiff(base: string, improved: string): TextDiffPart[] {
	const diffs = dmp.diff_main(base, improved);
	dmp.diff_cleanupSemantic(diffs);
	return diffs.map(([op, text]) => ({ op: op as DiffOperation, text }));
}

type QuestionFieldDiffProps = {
	base: string;
	improved: string;
	className?: string;
	inline?: boolean;
};

export function QuestionFieldDiff({ base, improved }: QuestionFieldDiffProps) {
	const parts = computeTextDiff(base, improved);

	return (
		<div
			data-testid="question-field-diff"
			className="rounded-md border bg-muted/40 px-3 py-2 text-sm leading-relaxed"
		>
			{parts.map((part, index) => {
				if (part.op === 0) {
					return <span key={index}>{part.text}</span>;
				}

				if (part.op === -1) {
					return (
						<mark
							key={index}
							className="rounded-sm bg-destructive/15 px-0.5 text-destructive line-through"
						>
							{part.text}
						</mark>
					);
				}

				return (
					<mark
						key={index}
						className="rounded-sm bg-emerald-100 px-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
					>
						{part.text}
					</mark>
				);
			})}
		</div>
	);
}
