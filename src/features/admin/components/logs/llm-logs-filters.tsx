"use client";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import type { LlmLogsListFilters } from "@/db/queries/llm-logs-admin";

export type LlmLogsFiltersProps = {
	filters: LlmLogsListFilters;
	onFiltersChange: (filters: LlmLogsListFilters) => void;
	users: Array<{ id: string; email: string }>;
};

const STATUS_OPTIONS = [
	{ value: "all", label: "Todos" },
	{ value: "pending", label: "Pendente" },
	{ value: "success", label: "Sucesso" },
	{ value: "error", label: "Erro" },
] as const;

export function LlmLogsFilters({
	filters,
	onFiltersChange,
	users,
}: LlmLogsFiltersProps) {
	const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
	const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;

	function update(key: keyof LlmLogsListFilters, value: string | undefined) {
		onFiltersChange({ ...filters, [key]: value || undefined });
	}

	function handleClear() {
		onFiltersChange({});
	}

	return (
		<div className="flex flex-wrap items-end gap-2">
			<div className="min-w-[10rem]">
				<Select
					value={filters.status ?? "all"}
					onValueChange={(val) =>
						update("status", val === "all" ? undefined : val)
					}
				>
					<SelectTrigger size="sm" className="w-full">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						{STATUS_OPTIONS.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Input
				placeholder="Provedor"
				className="w-[120px]"
				value={filters.provider ?? ""}
				onChange={(e) => update("provider", e.target.value || undefined)}
			/>

			<Input
				placeholder="Modelo"
				className="w-[120px]"
				value={filters.model ?? ""}
				onChange={(e) => update("model", e.target.value || undefined)}
			/>

			<Input
				placeholder="Tipo"
				className="w-[120px]"
				value={filters.callType ?? ""}
				onChange={(e) => update("callType", e.target.value || undefined)}
			/>

			<div className="min-w-[10rem]">
				<Select
					value={filters.userId ?? "all"}
					onValueChange={(val) =>
						update("userId", val === "all" ? undefined : val)
					}
				>
					<SelectTrigger size="sm" className="w-full">
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
			</div>

			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className={cn(
							"h-7 w-[130px]",
							!dateFrom && "text-muted-foreground",
						)}
					>
						<CalendarIcon className="mr-1 size-3" />
						{dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="single"
						selected={dateFrom}
						onSelect={(d) =>
							update("dateFrom", d ? format(d, "yyyy-MM-dd") : undefined)
						}
						locale={ptBR}
					/>
				</PopoverContent>
			</Popover>

			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className={cn(
							"h-7 w-[130px]",
							!dateTo && "text-muted-foreground",
						)}
					>
						<CalendarIcon className="mr-1 size-3" />
						{dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="single"
						selected={dateTo}
						onSelect={(d) =>
							update("dateTo", d ? format(d, "yyyy-MM-dd") : undefined)
						}
						locale={ptBR}
					/>
				</PopoverContent>
			</Popover>

			<Button variant="ghost" size="sm" onClick={handleClear}>
				Limpar
			</Button>
		</div>
	);
}
