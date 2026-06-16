import { Settings, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEFAULT_AGENT_CONCURRENCY = 10;
const MIN_AGENT_CONCURRENCY = 1;
const MAX_AGENT_CONCURRENCY = 20;
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md"];

interface UploadCardProps {
	onUpload: (
		file: File,
		enableReview: boolean,
		enableExplanations: boolean,
		agentConcurrency: number,
	) => void;
}

function isAcceptedFile(file: File): boolean {
	const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
	return ACCEPTED_EXTENSIONS.includes(extension);
}

export function UploadCard({ onUpload }: UploadCardProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragCounterRef = useRef(0);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [dragActive, setDragActive] = useState(false);
	const [enableReview, setEnableReview] = useState(true);
	const [enableExplanations, setEnableExplanations] = useState(true);
	const [agentConcurrency, setAgentConcurrency] = useState(
		DEFAULT_AGENT_CONCURRENCY,
	);

	function selectFile(file: File | null) {
		if (file && !isAcceptedFile(file)) return;
		setSelectedFile(file);
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		selectFile(e.target.files?.[0] ?? null);
	}

	function handleUpload() {
		if (!selectedFile) return;
		onUpload(selectedFile, enableReview, enableExplanations, agentConcurrency);
		setSelectedFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current += 1;
		setDragActive(true);
	}

	function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current -= 1;
		if (dragCounterRef.current === 0) {
			setDragActive(false);
		}
	}

	function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current = 0;
		setDragActive(false);
		selectFile(e.dataTransfer.files?.[0] ?? null);
	}

	return (
		<Card
			size="sm"
			className={cn(
				"shadow-sm transition-colors",
				dragActive && "bg-primary/5 ring-2 ring-primary/40",
			)}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<CardContent className="flex items-center gap-2">
				<div className="flex min-w-0 flex-1 items-stretch">
					<Button
						variant="outline"
						size="sm"
						type="button"
						className={cn(
							"h-8 min-w-0 flex-1 justify-start gap-1.5 rounded-r-none border-dashed px-2",
							!selectedFile && "text-muted-foreground",
						)}
						onClick={() => fileInputRef.current?.click()}
					>
						<Upload className="size-3 shrink-0" />
						<span className="truncate">
							{selectedFile ? selectedFile.name : "Selecionar arquivo"}
						</span>
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon-sm"
								type="button"
								className="h-8 shrink-0 rounded-l-none border-l-0"
								aria-label="Configuracoes de upload"
							>
								<Settings className="size-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							<DropdownMenuLabel>Configuracoes</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem
								checked={enableReview}
								onCheckedChange={setEnableReview}
								onSelect={(e) => e.preventDefault()}
							>
								Revisao critica
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={enableExplanations}
								onCheckedChange={setEnableExplanations}
								onSelect={(e) => e.preventDefault()}
							>
								Com explicacoes
							</DropdownMenuCheckboxItem>
							<DropdownMenuSeparator />
							<div
								className="flex items-center gap-2 px-2 py-1.5"
								onPointerDown={(e) => e.stopPropagation()}
							>
								<Label
									htmlFor="ingest-agent-concurrency"
									className="shrink-0 text-xs"
								>
									Agentes ({MIN_AGENT_CONCURRENCY}-{MAX_AGENT_CONCURRENCY})
								</Label>
								<Input
									id="ingest-agent-concurrency"
									type="number"
									min={MIN_AGENT_CONCURRENCY}
									max={MAX_AGENT_CONCURRENCY}
									value={agentConcurrency}
									onChange={(e) => {
										const value = Number(e.target.value);
										if (Number.isNaN(value)) return;
										setAgentConcurrency(
											Math.max(
												MIN_AGENT_CONCURRENCY,
												Math.min(MAX_AGENT_CONCURRENCY, value),
											),
										);
									}}
									className="ml-auto h-7 w-14"
								/>
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf,.txt,.md"
					onChange={handleFileChange}
					className="hidden"
				/>
				<Button
					onClick={handleUpload}
					disabled={!selectedFile}
					size="sm"
					type="button"
					className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600"
				>
					Upload
				</Button>
			</CardContent>
		</Card>
	);
}
