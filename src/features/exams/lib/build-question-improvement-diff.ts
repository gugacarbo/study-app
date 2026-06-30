import type { QuestionImprovementSnapshot } from "@/db/queries/question-improvement-drafts";

type QuestionOption = QuestionImprovementSnapshot["options"][number];

type QuestionImprovementMetadata = {
	topicId: string | null;
	topic: string | null;
	scoringMode: QuestionImprovementSnapshot["scoringMode"];
};

type ValueSection<T> = {
	changed: boolean;
	original: T;
	improved: T;
};

export type QuestionImprovementDiffSection =
	| "stem"
	| "options"
	| "answers"
	| "explanation"
	| "deepExplanation"
	| "metadata";

export type QuestionImprovementDiff = {
	hasChanges: boolean;
	changedSections: QuestionImprovementDiffSection[];
	sections: {
		stem: ValueSection<string>;
		options: ValueSection<QuestionOption[]>;
		answers: ValueSection<string[]>;
		explanation: ValueSection<string | null>;
		deepExplanation: ValueSection<string | null>;
		metadata: ValueSection<QuestionImprovementMetadata>;
	};
};

function normalizeOptionalString(value: string | null | undefined): string | null {
	if (value == null || value === "") {
		return null;
	}

	return value;
}

function normalizeMetadata(
	snapshot: QuestionImprovementSnapshot,
): QuestionImprovementMetadata {
	return {
		topicId: normalizeOptionalString(snapshot.topicId),
		topic: normalizeOptionalString(snapshot.topic),
		scoringMode: snapshot.scoringMode,
	};
}

function areOptionsEqual(
	left: QuestionImprovementSnapshot["options"],
	right: QuestionImprovementSnapshot["options"],
): boolean {
	if (left.length !== right.length) return false;

	return left.every((option, index) => {
		const other = right[index];
		return other != null && option.key === other.key && option.text === other.text;
	});
}

function areAnswersEqual(left: string[], right: string[]): boolean {
	if (left.length !== right.length) return false;

	return left.every((answer, index) => answer === right[index]);
}

function isMetadataEqual(
	left: QuestionImprovementMetadata,
	right: QuestionImprovementMetadata,
): boolean {
	return (
		left.topicId === right.topicId &&
		left.topic === right.topic &&
		left.scoringMode === right.scoringMode
	);
}

export function buildQuestionImprovementDiff(input: {
	original: QuestionImprovementSnapshot;
	improved: QuestionImprovementSnapshot;
}): QuestionImprovementDiff {
	const explanationOriginal = normalizeOptionalString(input.original.explanation);
	const explanationImproved = normalizeOptionalString(input.improved.explanation);
	const deepExplanationOriginal = normalizeOptionalString(
		input.original.deepExplanation,
	);
	const deepExplanationImproved = normalizeOptionalString(
		input.improved.deepExplanation,
	);
	const metadataOriginal = normalizeMetadata(input.original);
	const metadataImproved = normalizeMetadata(input.improved);

	const sections: QuestionImprovementDiff["sections"] = {
		stem: {
			changed: input.original.question !== input.improved.question,
			original: input.original.question,
			improved: input.improved.question,
		},
		options: {
			changed: !areOptionsEqual(input.original.options, input.improved.options),
			original: input.original.options,
			improved: input.improved.options,
		},
		answers: {
			changed: !areAnswersEqual(input.original.answers, input.improved.answers),
			original: input.original.answers,
			improved: input.improved.answers,
		},
		explanation: {
			changed: explanationOriginal !== explanationImproved,
			original: explanationOriginal,
			improved: explanationImproved,
		},
		deepExplanation: {
			changed: deepExplanationOriginal !== deepExplanationImproved,
			original: deepExplanationOriginal,
			improved: deepExplanationImproved,
		},
		metadata: {
			changed: !isMetadataEqual(metadataOriginal, metadataImproved),
			original: metadataOriginal,
			improved: metadataImproved,
		},
	};

	const changedSections = (
		Object.entries(sections) as Array<
			[QuestionImprovementDiffSection, ValueSection<unknown>]
		>
	)
		.filter(([, section]) => section.changed)
		.map(([section]) => section);

	return {
		hasChanges: changedSections.length > 0,
		changedSections,
		sections,
	};
}
