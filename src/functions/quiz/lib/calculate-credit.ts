/**
 * Crédito parcial proporcional simples.
 * Cada alternativa correta marcada soma 1/|correct|;
 * cada alternativa incorreta marcada subtrai 1/|correct|.
 * Mínimo zero.
 */
export function calculateCredit(
	selectedOptionIds: string[],
	correctOptionIds: string[],
): number {
	const totalCorrect = correctOptionIds.length;
	if (totalCorrect === 0) {
		return 0;
	}

	const correctSet = new Set(correctOptionIds);
	const uniqueSelected = Array.from(new Set(selectedOptionIds));

	let correctMarked = 0;
	let incorrectMarked = 0;

	for (const optionId of uniqueSelected) {
		if (correctSet.has(optionId)) {
			correctMarked += 1;
		} else {
			incorrectMarked += 1;
		}
	}

	return Math.max(
		0,
		correctMarked / totalCorrect - incorrectMarked / totalCorrect,
	);
}
