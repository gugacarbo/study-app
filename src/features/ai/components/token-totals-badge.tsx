import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";

export interface TokenTotals {
	prompt: number;
	completion: number;
	total: number;
}

interface TokenTotalsBadgeProps {
	tokenTotals: TokenTotals;
}

export function normalizeTokenTotals(
	value?: Partial<TokenTotals> | null,
): TokenTotals | null {
	if (!value) return null;

	const prompt = value.prompt ?? 0;
	const completion = value.completion ?? 0;
	const total = value.total ?? prompt + completion;

	return { prompt, completion, total };
}

export function TokenTotalsBadge({ tokenTotals }: TokenTotalsBadgeProps) {
	const [open, setOpen] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearCloseTimer = () => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	};

	const handleOpen = () => {
		clearCloseTimer();
		setOpen(true);
	};

	const handleClose = () => {
		clearCloseTimer();
		closeTimerRef.current = setTimeout(() => setOpen(false), 120);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Badge
					variant="secondary"
					className="cursor-default text-[0.625rem]"
					onMouseEnter={handleOpen}
					onMouseLeave={handleClose}
				>
					Tokens: {tokenTotals.total.toLocaleString()}
				</Badge>
			</PopoverTrigger>
			<PopoverContent
				className="w-auto min-w-40 p-3"
				align="end"
				side="bottom"
				onMouseEnter={handleOpen}
				onMouseLeave={handleClose}
			>
				<PopoverHeader>
					<PopoverTitle>Token usage</PopoverTitle>
					<PopoverDescription className="flex flex-col gap-1">
						<span>Input: {tokenTotals.prompt.toLocaleString()}</span>
						<span>Output: {tokenTotals.completion.toLocaleString()}</span>
					</PopoverDescription>
				</PopoverHeader>
			</PopoverContent>
		</Popover>
	);
}
