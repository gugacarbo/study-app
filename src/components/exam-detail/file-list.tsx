import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { formatFileSize } from "./exam-utils";

interface FileInfo {
	id: number;
	name: string;
	size: number | null;
}

interface FileListProps {
	files: FileInfo[];
}

export function FileList({ files }: FileListProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
					<FileText className="h-4 w-4" />
					Source Files
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-1.5">
					{files.map((file) => (
						<div
							key={file.id}
							className="flex items-center gap-2 text-sm text-muted-foreground"
						>
							<FileText className="h-3.5 w-3.5 shrink-0" />
							<span className="truncate">{file.name}</span>
							<span className="text-xs">({formatFileSize(file.size)})</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
