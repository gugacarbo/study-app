import { useMemo } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	XAxis,
	YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
export type LogsTimeChartProps = {
	data: Array<{
		date: string;
		count: number;
		avgDurationMs: number | null;
		errorCount: number;
	}>;
	granularity: "hour" | "day";
	onGranularityChange: (granularity: "hour" | "day") => void;
	isLoading?: boolean;
};

const chartConfig = {
	count: { label: "Requests", color: "var(--chart-1)" },
	errorCount: { label: "Erros", color: "var(--chart-2)" },
} satisfies ChartConfig;

function formatXAxis(dateStr: string, granularity: "hour" | "day") {
	if (granularity === "hour") {
		const [, hour] = dateStr.split(" ");
		return hour ? `${hour}:00` : dateStr;
	}
	const parts = dateStr.split("-");
	if (parts.length === 3) {
		return `${parts[2]}/${parts[1]}`;
	}
	return dateStr;
}

function SkeletonChart() {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex gap-2">
				<div className="h-7 w-14 animate-pulse rounded bg-muted" />
				<div className="h-7 w-14 animate-pulse rounded bg-muted" />
			</div>
			<div className="h-48 animate-pulse rounded-lg bg-muted" />
		</div>
	);
}

function EmptyChart() {
	return (
		<div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
			Nenhum dado disponível
		</div>
	);
}

export function LogsTimeChart({
	data,
	granularity,
	onGranularityChange,
	isLoading,
}: LogsTimeChartProps) {
	const hasData = data.length > 0;

	const granularityOptions = [
		{ value: "hour" as const, label: "Hora" },
		{ value: "day" as const, label: "Dia" },
	];

	const formattedData = useMemo(
		() =>
			data.map((d) => ({
				...d,
				dateLabel: formatXAxis(d.date, granularity),
			})),
		[data, granularity],
	);

	if (isLoading) {
		return <SkeletonChart />;
	}

	if (!hasData) {
		return (
			<div className="flex flex-col gap-4">
			<div className="flex gap-1">
				{granularityOptions.map((opt) => (
					<Button
						key={opt.value}
						variant={granularity === opt.value ? "default" : "outline"}
						size="sm"
						onClick={() => onGranularityChange(opt.value)}
					>
						{opt.label}
					</Button>
				))}
			</div>
			<EmptyChart />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex gap-1">
				{granularityOptions.map((opt) => (
					<Button
						key={opt.value}
						variant={granularity === opt.value ? "default" : "outline"}
						size="sm"
						onClick={() => onGranularityChange(opt.value)}
					>
						{opt.label}
					</Button>
				))}
			</div>
			<ChartContainer config={chartConfig} className="h-48">
				<AreaChart data={formattedData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
					<defs>
						<linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
							<stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.05} />
						</linearGradient>
						<linearGradient id="fillErrorCount" x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stopColor="var(--color-errorCount)" stopOpacity={0.3} />
							<stop offset="95%" stopColor="var(--color-errorCount)" stopOpacity={0.05} />
						</linearGradient>
					</defs>
					<CartesianGrid vertical={false} strokeDasharray="3 3" />
					<XAxis
						dataKey="dateLabel"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
					/>
					<YAxis
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						allowDecimals={false}
					/>
					<ChartTooltip
						cursor={false}
						content={<ChartTooltipContent indicator="dot" />}
					/>
					<Area
						dataKey="count"
						type="monotone"
						fill="url(#fillCount)"
						stroke="var(--color-count)"
						strokeWidth={2}
					/>
					<Area
						dataKey="errorCount"
						type="monotone"
						fill="url(#fillErrorCount)"
						stroke="var(--color-errorCount)"
						strokeWidth={2}
					/>
				</AreaChart>
			</ChartContainer>
		</div>
	);
}
