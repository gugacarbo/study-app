import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AdminJobListItem } from "@/features/admin/hooks/use-admin-jobs";
import {
	formatJobKind,
	formatJobPhase,
	formatJobStatus,
	formatJobTimestamp,
	truncateText,
} from "@/features/admin/lib/job-labels";
import { JOB_STATUS } from "@/lib/job-kinds";
import { cn } from "@/lib/utils";

type JobsTableProps = {
	jobs: AdminJobListItem[];
	selectedJobId: string | null;
	onSelectJob: (jobId: string) => void;
};

function statusBadgeVariant(status: string) {
	switch (status) {
		case JOB_STATUS.COMPLETED:
			return "default" as const;
		case JOB_STATUS.FAILED:
		case JOB_STATUS.CANCELLED:
			return "destructive" as const;
		case JOB_STATUS.RUNNING:
		case JOB_STATUS.QUEUED:
		case JOB_STATUS.AWAITING_UPLOAD:
			return "secondary" as const;
		default:
			return "outline" as const;
	}
}

export function JobsTable({ jobs, selectedJobId, onSelectJob }: JobsTableProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Jobs</CardTitle>
				<CardDescription>
					Últimos 100 jobs de todos os usuários. Clique em uma linha para ver
					detalhes.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Usuário</TableHead>
							<TableHead>Tipo</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Criado</TableHead>
							<TableHead>Erro</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{jobs.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="text-muted-foreground">
									Nenhum job encontrado.
								</TableCell>
							</TableRow>
						) : (
							jobs.map((job) => {
								const phaseLabel = formatJobPhase(job.phase);
								return (
									<TableRow
										key={job.id}
										className={cn(
											"cursor-pointer",
											selectedJobId === job.id && "bg-muted/50",
										)}
										onClick={() => onSelectJob(job.id)}
									>
										<TableCell className="font-medium">
											{job.userEmail ?? job.userId}
										</TableCell>
										<TableCell>{formatJobKind(job.kind)}</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1">
												<Badge variant={statusBadgeVariant(job.status)}>
													{formatJobStatus(job.status)}
												</Badge>
												{phaseLabel ? (
													<span className="text-xs text-muted-foreground">
														{phaseLabel}
													</span>
												) : null}
											</div>
										</TableCell>
										<TableCell className="whitespace-nowrap text-sm">
											{formatJobTimestamp(job.createdAt)}
										</TableCell>
										<TableCell className="max-w-[12rem] text-sm text-muted-foreground">
											{truncateText(job.error)}
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
