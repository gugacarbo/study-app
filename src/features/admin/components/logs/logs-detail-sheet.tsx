"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export type DetailField = {
	key: string;
	label: string;
	type?: "text" | "code" | "badge";
	badgeVariant?: "default" | "success" | "error" | "warning";
	render?: (value: unknown) => React.ReactNode;
};

export type LogsDetailSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	fields: DetailField[];
	data: Record<string, unknown> | null;
	isLoading?: boolean;
};

const BADGE_MAP: Record<
	NonNullable<DetailField["badgeVariant"]>,
	"default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
> = {
	default: "default",
	success: "default",
	error: "destructive",
	warning: "secondary",
};

function FieldSkeleton() {
	return (
		<div className="space-y-1.5">
			<Skeleton className="h-3 w-20" />
			<Skeleton className="h-5 w-full" />
		</div>
	);
}

function FieldValue({
	field,
	value,
}: {
	field: DetailField;
	value: unknown;
}) {
	const [expanded, setExpanded] = useState(false);

	if (field.render) {
		return <>{field.render(value)}</>;
	}

	if (value == null) {
		return <span className="text-muted-foreground">—</span>;
	}

	const strValue = String(value);

	if (field.type === "code") {
		return (
			<pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
				<code>{strValue}</code>
			</pre>
		);
	}

	if (field.type === "badge") {
		const variant = BADGE_MAP[field.badgeVariant ?? "default"];
		return <Badge variant={variant}>{strValue}</Badge>;
	}

	if (strValue.length > 2000 && !expanded) {
		return (
			<div>
				<span className="text-sm">{strValue.slice(0, 2000)}…</span>
				<Button
					variant="link"
					size="xs"
					className="h-auto px-0 text-xs"
					onClick={() => setExpanded(true)}
				>
					Mostrar mais
				</Button>
			</div>
		);
	}

	return <span className="text-sm">{strValue}</span>;
}

export function LogsDetailSheet({
	open,
	onOpenChange,
	title,
	fields,
	data,
	isLoading,
}: LogsDetailSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex w-full flex-col sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>{title}</SheetTitle>
					<SheetDescription>
						{data
							? "Detalhes do log selecionado"
							: "Selecione um log para visualizar"}
					</SheetDescription>
				</SheetHeader>

				{!data && !isLoading ? (
					<div className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
						Selecione um log para visualizar
					</div>
				) : (
					<ScrollArea className="flex-1 px-4 pb-4">
						<div className="space-y-4">
							{isLoading
								? fields.map((field) => <FieldSkeleton key={field.key} />)
								: fields.map((field) => (
										<div key={field.key} className="space-y-1.5">
											<dt className="text-xs font-medium text-muted-foreground">
												{field.label}
											</dt>
											<dd>
												<FieldValue
													field={field}
													value={data?.[field.key]}
												/>
											</dd>
										</div>
									))}
						</div>
					</ScrollArea>
				)}
			</SheetContent>
		</Sheet>
	);
}
