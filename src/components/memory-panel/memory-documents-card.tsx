import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MemoryDocument {
	id: number;
	type: string;
	name: string;
	topic: string | null;
	createdAt: string;
}

export function MemoryDocumentsCard({
	documents,
}: {
	documents: MemoryDocument[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Memory Documents</CardTitle>
			</CardHeader>
			<CardContent>
				{documents.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No memory documents saved yet.
					</p>
				) : (
					<div className="flex flex-col gap-2">
						{documents.map((doc) => (
							<div key={doc.id} className="text-sm">
								<span className="font-medium">{doc.name}</span>
								<span className="text-muted-foreground">
									{" "}
									&bull; {doc.type} &bull; {doc.createdAt}
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
