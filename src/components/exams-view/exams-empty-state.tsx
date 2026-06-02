import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ExamsEmptyState() {
	return (
		<Card className="items-center py-12">
			<FileText className="h-12 w-12 text-muted-foreground" />
			<p className="text-muted-foreground">No exams uploaded yet.</p>
			<Button asChild>
				<Link from="/exams" to="/exams/upload">Upload your first exam</Link>
			</Button>
		</Card>
	);
}
