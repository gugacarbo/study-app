interface TextPartLike {
	type?: string;
	text?: string;
}

interface MessageLike {
	parts?: readonly TextPartLike[];
}

export function estimateThreadTextLength(
	messages: readonly unknown[] | undefined,
): number {
	if (!messages?.length) return 0;

	let chars = 0;
	for (const message of messages) {
		const parts = (message as MessageLike).parts ?? [];
		for (const part of parts) {
			if (part.type === "text" && typeof part.text === "string") {
				chars += part.text.length;
			}
		}
	}
	return chars;
}
