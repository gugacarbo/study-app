import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface UploadCardProps {
	onUpload: (file: File, enableReview: boolean) => void;
}

export function UploadCard({ onUpload }: UploadCardProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [enableReview, setEnableReview] = useState(true);

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] ?? null;
		setSelectedFile(file);
	}

	function handleUpload() {
		if (!selectedFile) return;
		onUpload(selectedFile, enableReview);
		setSelectedFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	return (
		<Card className="border-white/10 bg-[#1b2638] text-slate-100 shadow-sm">
			<CardHeader>
				<CardTitle className="text-sm font-semibold">Upload</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="h-16 w-full flex-col justify-center gap-1 rounded-md border border-dashed border-slate-500/60 text-slate-300 hover:bg-slate-800/70"
						onClick={() => fileInputRef.current?.click()}
					>
						<Upload className="size-3.5" />
						{selectedFile ? selectedFile.name : "Drop file"}
					</Button>
				</div>
				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf,.txt,.md"
					onChange={handleFileChange}
					className="hidden"
				/>
				<div className="flex items-center justify-between rounded-md border border-white/10 bg-[#111b2c] px-3 py-2">
					<Label
						htmlFor="ingest-review-toggle"
						className="text-xs text-slate-300"
					>
						Revisao critica
					</Label>
					<button
						id="ingest-review-toggle"
						type="button"
						role="switch"
						aria-checked={enableReview}
						onClick={() => setEnableReview((prev) => !prev)}
						className={cn(
							"relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
							enableReview ? "bg-emerald-500" : "bg-slate-700",
						)}
					>
						<span
							className={cn(
								"inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
								enableReview ? "translate-x-4" : "translate-x-0.5",
							)}
						/>
					</button>
				</div>
				<Button
					onClick={handleUpload}
					disabled={!selectedFile}
					size="sm"
					className="bg-emerald-600 text-white hover:bg-emerald-500"
				>
					Upload &amp; Extract
				</Button>
			</CardContent>
		</Card>
	);
}
