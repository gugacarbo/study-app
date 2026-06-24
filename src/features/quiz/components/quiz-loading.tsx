import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function QuizLoading() {
	return (
		<Card>
			<CardContent className="space-y-4 pt-6">
				<div className="flex justify-between">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-4 w-24" />
				</div>
				<Skeleton className="h-6 w-full" />
				<Skeleton className="h-6 w-3/4" />
				<div className="flex flex-col gap-2">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
				</div>
				<Skeleton className="h-9 w-full" />
			</CardContent>
		</Card>
	);
}
