import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopicNote {
	topic: string;
	updatedAt: string;
}

export function TopicNotesCard({ topicNotes }: { topicNotes: TopicNote[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Topic Notes</CardTitle>
			</CardHeader>
			<CardContent>
				{topicNotes.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No topic notes saved yet.
					</p>
				) : (
					<div className="flex flex-col gap-2">
						{topicNotes.map((note) => (
							<div key={`${note.topic}-${note.updatedAt}`} className="text-sm">
								{note.topic}{" "}
								<span className="text-muted-foreground">
									({note.updatedAt})
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
