import { Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";

interface TopicListProps {
	topics: string[];
}

export function TopicList({ topics }: TopicListProps) {
	return (
		<Card className="mb-4">
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
					<Tag className="h-4 w-4" />
					Topics
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-1.5">
					{topics.map((topic) => (
						<Badge key={topic} variant="secondary">
							{topic}
						</Badge>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
