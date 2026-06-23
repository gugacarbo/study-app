"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type Column = {
	key: string;
	header: string;
	width?: string;
	render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
	sortable?: boolean;
};

export type TableFilter = {
	key: string;
	label: string;
	type: "text" | "select" | "date";
	options?: { value: string; label: string }[];
};

export type LogsTableProps = {
	columns: Column[];
	data: Array<Record<string, unknown>>;
	total: number;
	page: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
	filters: TableFilter[];
	filterValues: Record<string, string | undefined>;
	onFilterChange: (key: string, value: string | undefined) => void;
	onRowClick?: (row: Record<string, unknown>) => void;
	isLoading?: boolean;
};

function DateFilter({
	value,
	onChange,
	label,
}: {
	value: string | undefined;
	onChange: (value: string | undefined) => void;
	label: string;
}) {
	const date = value ? new Date(value) : undefined;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn("h-7 w-full min-w-0", !date && "text-muted-foreground")}
				>
					{date ? format(date, "dd/MM/yyyy") : label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={date}
					onSelect={(selectedDate) =>
						onChange(
							selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined,
						)
					}
					locale={ptBR}
				/>
			</PopoverContent>
		</Popover>
	);
}

function FilterRow({
	filters,
	filterValues,
	onFilterChange,
}: {
	filters: TableFilter[];
	filterValues: Record<string, string | undefined>;
	onFilterChange: (key: string, value: string | undefined) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			{filters.map((filter) => (
				<div key={filter.key} className="min-w-[10rem]">
					{filter.type === "text" ? (
						<Input
							placeholder={filter.label}
							value={filterValues[filter.key] ?? ""}
							onChange={(e) =>
								onFilterChange(filter.key, e.target.value || undefined)
							}
						/>
					) : filter.type === "select" ? (
						<Select
							value={filterValues[filter.key] ?? "all"}
							onValueChange={(val) =>
								onFilterChange(filter.key, val === "all" ? undefined : val)
							}
						>
							<SelectTrigger size="sm" className="w-full">
								<SelectValue placeholder={filter.label} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Todos</SelectItem>
								{filter.options?.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<DateFilter
							value={filterValues[filter.key]}
							onChange={(val) => onFilterChange(filter.key, val)}
							label={filter.label}
						/>
					)}
				</div>
			))}
		</div>
	);
}

function SkeletonRows({
	columns,
	count = 5,
}: {
	columns: Column[];
	count?: number;
}) {
	return (
		<>
			{Array.from({ length: count }).map((_, rowIdx) => (
				<TableRow key={rowIdx}>
					{columns.map((col) => (
						<TableCell key={col.key}>
							<Skeleton className="h-4 w-full" />
						</TableCell>
					))}
				</TableRow>
			))}
		</>
	);
}

export function LogsTable({
	columns,
	data,
	total,
	page,
	pageSize,
	onPageChange,
	onPageSizeChange,
	filters,
	filterValues,
	onFilterChange,
	onRowClick,
	isLoading,
}: LogsTableProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const startRow = total > 0 ? (page - 1) * pageSize + 1 : 0;
	const endRow = Math.min(page * pageSize, total);

	return (
		<div className="space-y-4">
			{filters.length > 0 ? (
				<FilterRow
					filters={filters}
					filterValues={filterValues}
					onFilterChange={onFilterChange}
				/>
			) : null}

			<div className="overflow-x-auto rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							{columns.map((col) => (
								<TableHead
									key={col.key}
									style={col.width ? { width: col.width } : undefined}
								>
									{col.header}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<SkeletonRows columns={columns} />
						) : data.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="text-center text-muted-foreground"
								>
									Nenhum log encontrado
								</TableCell>
							</TableRow>
						) : (
							data.map((row, i) => (
								<TableRow
									key={i}
									className={cn(onRowClick && "cursor-pointer")}
									onClick={() => onRowClick?.(row)}
								>
									{columns.map((col) => (
										<TableCell key={col.key}>
											{col.render
												? col.render(row[col.key], row)
												: String(row[col.key] ?? "")}
										</TableCell>
									))}
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<span>Linhas por página:</span>
					<Select
						value={String(pageSize)}
						onValueChange={(val) => onPageSizeChange(Number(val))}
					>
						<SelectTrigger size="sm" className="h-7 w-16">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{[25, 50, 100].map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<span>
						{total > 0
							? `${startRow}–${endRow} de ${total}`
							: "0 resultados"}
					</span>
				</div>

				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="icon-sm"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
					>
						<ChevronLeftIcon className="size-4" />
					</Button>
					<span className="px-2 text-sm text-muted-foreground">
						Página {page} de {totalPages}
					</span>
					<Button
						variant="outline"
						size="icon-sm"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
					>
						<ChevronRightIcon className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
