export function ChatError({ error }: { error: Error }) {
	return (
		<div className="flex justify-center">
			<div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
				{error.message}
			</div>
		</div>
	);
}
