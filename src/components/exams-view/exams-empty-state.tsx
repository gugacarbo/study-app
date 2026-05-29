import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { UploadForm } from "../upload-form/upload-form";

interface ExamsEmptyStateProps {
	uploadOpen: boolean;
	onUploadOpenChange: (open: boolean) => void;
	onUploadSuccess: () => void;
}

export function ExamsEmptyState({
	uploadOpen,
	onUploadOpenChange,
	onUploadSuccess,
}: ExamsEmptyStateProps) {
	return (
		<Card className="items-center py-12">
			<FileText className="h-12 w-12 text-muted-foreground" />
			<p className="text-muted-foreground">No exams uploaded yet.</p>
			<Dialog open={uploadOpen} onOpenChange={onUploadOpenChange}>
				<DialogTrigger asChild>
					<Button>Upload your first exam</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Upload Exam</DialogTitle>
					</DialogHeader>
					<UploadForm onSuccess={onUploadSuccess} />
				</DialogContent>
			</Dialog>
		</Card>
	);
}
