import { diff_match_patch as DiffMatchPatch } from "diff-match-patch";

export type DiffOperation = -1 | 0 | 1;

export type DiffPart = {
	operation: DiffOperation;
	text: string;
};

export function computeTextDiff(
	original: string,
	modified: string,
): DiffPart[] {
	const differ = new DiffMatchPatch();
	const diffs = differ.diff_main(original, modified);
	differ.diff_cleanupSemantic(diffs);

	return diffs.map(([operation, text]) => ({
		operation: operation as DiffOperation,
		text,
	}));
}
