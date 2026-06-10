export type ScoringMode = "exact" | "partial";

export function normalizeAnswerSet(values: string[]): Set<string> {
	return new Set(
		values.map((value) => value.trim().toLowerCase()).filter(Boolean),
	);
}

export function isOptionCorrect(option: string, answers: string[]): boolean {
	const normalizedOption = option.trim().toLowerCase();
	return answers.some(
		(answer) => answer.trim().toLowerCase() === normalizedOption,
	);
}

export function scoreAnswer(
	userAnswers: string[],
	correctAnswers: string[],
	scoringMode: ScoringMode = "exact",
): { credit: number; isFullyCorrect: boolean } {
	const userSet = normalizeAnswerSet(userAnswers);
	const correctSet = normalizeAnswerSet(correctAnswers);

	if (correctSet.size === 0) {
		return { credit: 0, isFullyCorrect: false };
	}

	if (scoringMode === "exact") {
		const isFullyCorrect =
			userSet.size === correctSet.size &&
			[...userSet].every((answer) => correctSet.has(answer));
		return { credit: isFullyCorrect ? 1 : 0, isFullyCorrect };
	}

	let hits = 0;
	let misses = 0;
	for (const answer of userSet) {
		if (correctSet.has(answer)) {
			hits += 1;
		} else {
			misses += 1;
		}
	}

	const credit = Math.max(
		0,
		Math.min(1, (hits - misses) / correctSet.size),
	);
	return { credit, isFullyCorrect: credit >= 1 };
}
