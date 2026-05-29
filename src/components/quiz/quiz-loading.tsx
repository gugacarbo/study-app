import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function QuizLoading({ withButton }: { withButton?: boolean }) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-4 pt-6">
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
				{withButton && <Skeleton className="h-10 w-full mt-2" />}
			</CardContent>
		</Card>
	);
}
