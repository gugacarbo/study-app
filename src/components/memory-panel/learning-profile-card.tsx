import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ui/markdown";

export function LearningProfileCard({
	profileSummary,
}: {
	profileSummary: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Learning Profile</CardTitle>
			</CardHeader>
			<CardContent>
				{profileSummary ? (
					<MarkdownRenderer
						content={profileSummary}
						className="text-xs text-muted-foreground"
					/>
				) : (
					<p className="text-sm text-muted-foreground">
						No profile yet. Complete a quiz and we will start tracking memory.
					</p>
				)}
			</CardContent>
		</Card>
	);
}
