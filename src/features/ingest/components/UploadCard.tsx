import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface UploadCardProps {
	onUpload: (
		file: File,
		enableReview: boolean,
		enableExplanations: boolean,
	) => void;
}

export function UploadCard({ onUpload }: UploadCardProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [enableReview, setEnableReview] = useState(true);
	const [enableExplanations, setEnableExplanations] = useState(true);

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] ?? null;
		setSelectedFile(file);
	}

	function handleUpload() {
		if (!selectedFile) return;
		onUpload(selectedFile, enableReview, enableExplanations);
		setSelectedFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	return (
		<Card size="sm" className="shadow-sm">
			<CardHeader>
				<CardTitle className="text-sm font-semibold">Upload</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"h-16 w-full flex-col justify-center gap-1 border-dashed",
						!selectedFile && "text-muted-foreground",
					)}
					onClick={() => fileInputRef.current?.click()}
				>
					<Upload className="size-3.5" />
					{selectedFile ? selectedFile.name : "Drop file"}
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf,.txt,.md"
					onChange={handleFileChange}
					className="hidden"
				/>
				<div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
					<Label htmlFor="ingest-review-toggle" className="text-xs">
						Revisao critica
					</Label>
					<Switch
						id="ingest-review-toggle"
						checked={enableReview}
						onCheckedChange={setEnableReview}
					/>
				</div>
				<div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
					<Label htmlFor="ingest-explanations-toggle" className="text-xs">
						Com explicacoes
					</Label>
					<Switch
						id="ingest-explanations-toggle"
						checked={enableExplanations}
						onCheckedChange={setEnableExplanations}
					/>
				</div>
				<Button
					onClick={handleUpload}
					disabled={!selectedFile}
					size="sm"
					className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600"
				>
					Upload &amp; Extract
				</Button>
			</CardContent>
		</Card>
	);
}
