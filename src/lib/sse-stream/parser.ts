export function parseEventBlock(
	block: string,
): { event: string; data: string } | null {
	const lines = block.split(/\r?\n/);
	let event = "message";
	const dataLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith("event:")) {
			event = line.slice("event:".length).trim();
			continue;
		}
		if (line.startsWith("data:")) {
			dataLines.push(line.slice("data:".length).trim());
		}
	}

	if (dataLines.length === 0) return null;
	return { event, data: dataLines.join("\n") };
}

function toNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

export function readTokenValue(
	value: unknown,
	keys: string[],
): number | undefined {
	if (typeof value !== "object" || value === null) return undefined;

	for (const key of keys) {
		if (key in value) {
			const candidate = toNumber((value as Record<string, unknown>)[key]);
			if (candidate != null) return candidate;
		}
	}

	return undefined;
}


