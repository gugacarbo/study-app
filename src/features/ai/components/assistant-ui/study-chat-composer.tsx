import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { ArrowUpIcon, Settings, ShieldCheck, SquareIcon } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AiModelPublic } from "@/db/queries/types";
import {
	ComposerAddAttachment,
	ComposerAttachments,
} from "@/features/ai/components/assistant-ui/attachment";
import { TooltipIconButton } from "@/features/ai/components/assistant-ui/tooltip-icon-button";

interface StudyChatComposerProps {
	reviewMode: boolean;
	onReviewModeChange: (value: boolean) => void;
	inputTokens: number;
	outputTokens: number;
	contextTokens: number;
	models: AiModelPublic[];
	selectedModelId: number | null;
	onSelectedModelChange: (modelId: number) => void;
}

export function StudyChatComposer({
	reviewMode,
	onReviewModeChange,
	inputTokens,
	outputTokens,
	contextTokens,
	models,
	selectedModelId,
	onSelectedModelChange,
}: StudyChatComposerProps) {
	return (
		<ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
			<ComposerPrimitive.AttachmentDropzone asChild>
				<div
					data-slot="aui_composer-shell"
					className="bg-background border-border/60 data-[dragging=true]:border-ring data-[dragging=true]:bg-accent/50 focus-within:border-border dark:border-muted-foreground/15 dark:bg-muted/30 dark:focus-within:border-muted-foreground/30 flex w-full flex-col gap-2 rounded-3xl border p-2 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.05)] data-[dragging=true]:border-dashed dark:shadow-none"
				>
					<ComposerAttachments />
					<ComposerPrimitive.Input
						placeholder="Ask a question..."
						className="aui-composer-input placeholder:text-muted-foreground/80 max-h-32 min-h-20 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none"
						rows={3}
						autoFocus
						aria-label="Message input"
					/>
					<StudyChatComposerAction
						reviewMode={reviewMode}
						onReviewModeChange={onReviewModeChange}
						inputTokens={inputTokens}
						outputTokens={outputTokens}
						contextTokens={contextTokens}
						models={models}
						selectedModelId={selectedModelId}
						onSelectedModelChange={onSelectedModelChange}
					/>
				</div>
			</ComposerPrimitive.AttachmentDropzone>
		</ComposerPrimitive.Root>
	);
}

function StudyChatComposerAction({
	reviewMode,
	onReviewModeChange,
	inputTokens,
	outputTokens,
	contextTokens,
	models,
	selectedModelId,
	onSelectedModelChange,
}: StudyChatComposerProps) {
	const hasModels = models.length > 0;
	const selectedModel = models.find((model) => model.id === selectedModelId);
	const selectValue = selectedModel ? String(selectedModel.id) : "";

	return (
		<div className="aui-composer-action-wrapper relative flex items-center justify-between">
			<div className="flex items-center gap-1">
				<ComposerAddAttachment />
				<Select
					value={selectValue}
					disabled={!hasModels}
					onValueChange={(value) => {
						const modelId = Number.parseInt(value, 10);
						if (Number.isFinite(modelId) && modelId > 0) {
							onSelectedModelChange(modelId);
						}
					}}
				>
					<SelectTrigger
						size="sm"
						className="h-8 max-w-48 text-xs"
						aria-label="Select model"
					>
						<SelectValue
							placeholder={
								hasModels ? "Select model" : "No models available"
							}
						/>
					</SelectTrigger>
					<SelectContent align="start" side="top">
						{models.map((model) => (
							<SelectItem key={model.id} value={String(model.id)}>
								{model.displayName} ({model.providerName})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
							type="button"
						>
							<Settings className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" side="top" className="w-64">
						<DropdownMenuLabel>Settings</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => onReviewModeChange(!reviewMode)}
							className="flex items-center justify-between"
						>
							<span>Review mode</span>
							<span className="text-[11px] text-muted-foreground">
								{reviewMode ? "On" : "Off"}
							</span>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-[11px] text-muted-foreground">
							input: {inputTokens.toLocaleString()} • output:{" "}
							{outputTokens.toLocaleString()} • context:{" "}
							{contextTokens.toLocaleString()} tokens
						</DropdownMenuLabel>
					</DropdownMenuContent>
				</DropdownMenu>
				{reviewMode ? (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 shrink-0 text-primary hover:text-primary"
									type="button"
									onClick={() => onReviewModeChange(false)}
								>
									<ShieldCheck className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top">
								Review mode active — click to disable
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : null}
			</div>
			<div className="flex items-center gap-1.5">
				<AuiIf condition={(state) => !state.thread.isRunning}>
					<ComposerPrimitive.Send asChild>
						<TooltipIconButton
							tooltip="Send message"
							side="bottom"
							type="button"
							variant="default"
							size="icon"
							className="aui-composer-send size-7 rounded-full"
							aria-label="Send message"
							disabled={!hasModels || !selectedModelId}
						>
							<ArrowUpIcon className="aui-composer-send-icon size-4.5" />
						</TooltipIconButton>
					</ComposerPrimitive.Send>
				</AuiIf>
				<AuiIf condition={(state) => state.thread.isRunning}>
					<ComposerPrimitive.Cancel asChild>
						<Button
							type="button"
							variant="default"
							size="icon"
							className="aui-composer-cancel size-7 rounded-full"
							aria-label="Stop generating"
						>
							<SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
						</Button>
					</ComposerPrimitive.Cancel>
				</AuiIf>
			</div>
		</div>
	);
}

export function createStudyChatComposer(props: StudyChatComposerProps): FC {
	return function StudyChatComposerSlot() {
		return <StudyChatComposer {...props} />;
	};
}
