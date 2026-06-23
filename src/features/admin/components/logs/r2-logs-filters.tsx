"use client";

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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { R2LogsListFilters } from "@/db/queries/r2-logs-admin";

export type R2LogsFiltersProps = {
	filters: R2LogsListFilters;
	onFiltersChange: (filters: R2LogsListFilters) => void;
	users: Array<{ id: string; email: string }>;
};

const operations = [
	{ value: "get", label: "Get" },
	{ value: "put", label: "Put" },
	{ value: "delete", label: "Delete" },
	{ value: "head", label: "Head" },
	{ value: "list", label: "List" },
];

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
					className={cn("h-7 w-[8rem]", !date && "text-muted-foreground")}
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

export function R2LogsFilters({
	filters,
	onFiltersChange,
	users,
}: R2LogsFiltersProps) {
	function update(key: keyof R2LogsListFilters, value: string | undefined) {
		onFiltersChange({ ...filters, [key]: value });
	}

	const hasAnyFilter = (Object.keys(filters) as (keyof R2LogsListFilters)[]).some(
		(k) => filters[k] != null && filters[k] !== "",
	);

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Select
				value={filters.status ?? "all"}
				onValueChange={(v) =>
					update("status", v === "all" ? undefined : v)
				}
			>
				<SelectTrigger size="sm" className="w-[8rem]">
					<SelectValue placeholder="Status" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Todos</SelectItem>
					<SelectItem value="success">Success</SelectItem>
					<SelectItem value="error">Error</SelectItem>
				</SelectContent>
			</Select>

			<Input
				placeholder="Bucket"
				value={filters.bucket ?? ""}
				onChange={(e) => update("bucket", e.target.value || undefined)}
				className="h-7 w-[10rem]"
			/>

			<Select
				value={filters.operation ?? "all"}
				onValueChange={(v) =>
					update("operation", v === "all" ? undefined : v)
				}
			>
				<SelectTrigger size="sm" className="w-[8rem]">
					<SelectValue placeholder="Operação" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Todos</SelectItem>
					{operations.map((op) => (
						<SelectItem key={op.value} value={op.value}>
							{op.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Select
				value={filters.userId ?? "all"}
				onValueChange={(v) =>
					update("userId", v === "all" ? undefined : v)
				}
			>
				<SelectTrigger size="sm" className="w-[10rem]">
					<SelectValue placeholder="Usuário" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Todos</SelectItem>
					{users.map((user) => (
						<SelectItem key={user.id} value={user.id}>
							{user.email}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<DateFilter
				label="De"
				value={filters.dateFrom}
				onChange={(v) => update("dateFrom", v)}
			/>
			<DateFilter
				label="Até"
				value={filters.dateTo}
				onChange={(v) => update("dateTo", v)}
			/>

			{hasAnyFilter ? (
				<Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
					Limpar
				</Button>
			) : null}
		</div>
	);
}
