import { useState } from "react";
import { formatMutationError } from "@/features/admin/lib/mutation-error";

export function usePanelAction() {
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function run<T>(action: () => Promise<T>) {
		setBusy(true);
		setError(null);
		try {
			return await action();
		} catch (cause) {
			setError(await formatMutationError(cause));
		} finally {
			setBusy(false);
		}
	}

	return { error, busy, run };
}
